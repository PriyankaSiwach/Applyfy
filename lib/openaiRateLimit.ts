import { auth } from "@clerk/nextjs/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { jsonNoStore } from "@/lib/jsonResponseNoStore";

/**
 * Sliding-window rate limits for OpenAI-backed routes, per signed-in userId
 * or per IP for guests. Two independent buckets:
 * - heavy: 5 requests / minute (full analyses, generation, multi-call pipelines)
 * - light: 20 requests / minute (editor re-scoring, keyword helpers, single-line rewrites)
 * Separate from lifetime/monthly usage quotas.
 */

export type OpenAiRateLimitTier = "heavy" | "light";

type RateLimitOk = { ok: true };
type RateLimitBlocked = {
  ok: false;
  response: ReturnType<typeof jsonNoStore>;
};

const TIER_CONFIG: Record<
  OpenAiRateLimitTier,
  { requests: number; prefix: string }
> = {
  heavy: { requests: 5, prefix: "applyfy:openai" },
  light: { requests: 20, prefix: "applyfy:openai-light" },
};

const ratelimits: Partial<Record<OpenAiRateLimitTier, Ratelimit>> = {};
let redis: Redis | null = null;

function getRatelimit(tier: OpenAiRateLimitTier): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const existing = ratelimits[tier];
  if (existing) return existing;

  if (!redis) redis = new Redis({ url, token });
  const { requests, prefix } = TIER_CONFIG[tier];
  const created = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, "1 m"),
    analytics: true,
    prefix,
  });
  ratelimits[tier] = created;
  return created;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export async function enforceOpenAiRateLimit(
  request: Request,
  tier: OpenAiRateLimitTier = "heavy",
): Promise<RateLimitOk | RateLimitBlocked> {
  const limiter = getRatelimit(tier);
  if (!limiter) {
    // Production must fail closed: without Redis there is no limit on OpenAI spend.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[openaiRateLimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing in production — rejecting request",
      );
      return {
        ok: false,
        response: jsonNoStore(
          {
            error: "AI features are temporarily unavailable. Please try again later.",
            code: "RATE_LIMIT_UNAVAILABLE",
          },
          { status: 503 },
        ),
      };
    }
    // Local/dev without Upstash: skip (do not break existing quotas).
    console.warn(
      "[openaiRateLimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing — rate limit skipped",
    );
    return { ok: true };
  }

  const { userId } = await auth();
  const identifier = userId ? `user:${userId}` : `ip:${clientIp(request)}`;

  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  if (success) return { ok: true };

  const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return {
    ok: false,
    response: jsonNoStore(
      {
        error: `Too many AI requests. Limit is ${limit} requests per minute. Please wait and try again.`,
        code: "RATE_LIMITED",
        limit,
        remaining,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
        },
      },
    ),
  };
}
