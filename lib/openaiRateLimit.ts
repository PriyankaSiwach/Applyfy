import { auth } from "@clerk/nextjs/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { jsonNoStore } from "@/lib/jsonResponseNoStore";

/**
 * Sliding-window rate limit for OpenAI-backed routes.
 * 5 requests / minute per signed-in userId, or per IP for guests.
 * Separate from lifetime/monthly usage quotas.
 */

type RateLimitOk = { ok: true };
type RateLimitBlocked = {
  ok: false;
  response: ReturnType<typeof jsonNoStore>;
};

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      analytics: true,
      prefix: "applyfy:openai",
    });
  }
  return ratelimit;
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
): Promise<RateLimitOk | RateLimitBlocked> {
  const limiter = getRatelimit();
  if (!limiter) {
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
        error:
          "Too many AI requests. Limit is 5 requests per minute. Please wait and try again.",
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
