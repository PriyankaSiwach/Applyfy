import { auth, clerkClient } from "@clerk/nextjs/server";

import { effectiveTierFromClerkPublicMetadata } from "@/lib/effectiveSubscriptionTier";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { hasPremiumPlan, isAdminBypassEmail } from "@/lib/tier";
import type { AppTier } from "@/lib/tier";

export type PremiumApiGate =
  | { ok: true; tier: AppTier }
  | { ok: false; response: ReturnType<typeof jsonNoStore> };

/**
 * Server-side guard for Premium-only APIs (simulator score, salary coach, etc.).
 */
export async function requirePremiumForApi(request: Request): Promise<PremiumApiGate> {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      response: jsonNoStore(
        { error: "Sign in required.", code: "AUTH_REQUIRED" },
        { status: 401 },
      ),
    };
  }

  try {
    const c = await clerkClient();
    const user = await c.users.getUser(userId);
    const primaryEmail =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? null;
    const reqHost =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
      request.headers.get("host") ??
      null;
    if (isAdminBypassEmail(primaryEmail, reqHost)) {
      return { ok: true, tier: "premium" };
    }
    const tier = await effectiveTierFromClerkPublicMetadata(
      user.publicMetadata as Record<string, unknown>,
    );
    if (!hasPremiumPlan(tier)) {
      return {
        ok: false,
        response: jsonNoStore(
          {
            error: "Premium subscription required.",
            code: "PREMIUM_REQUIRED",
          },
          { status: 403 },
        ),
      };
    }
    return { ok: true, tier };
  } catch (e) {
    console.error("[requirePremiumForApi]", e);
    return {
      ok: false,
      response: jsonNoStore(
        { error: "Could not verify subscription." },
        { status: 500 },
      ),
    };
  }
}
