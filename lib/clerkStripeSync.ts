import { clerkClient } from "@clerk/nextjs/server";

import type { AppTier } from "@/lib/tier";

export async function mergeClerkPublicMetadata(
  clerkUserId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const c = await clerkClient();
  const user = await c.users.getUser(clerkUserId);
  const prev =
    (user.publicMetadata as Record<string, unknown> | undefined) ?? {};
  await c.users.updateUser(clerkUserId, {
    publicMetadata: { ...prev, ...patch },
  });
}

export async function setClerkSubscriptionTier(
  clerkUserId: string,
  tier: AppTier,
  opts?: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = { subscriptionTier: tier };
  if (opts?.stripeCustomerId !== undefined) {
    patch.stripeCustomerId = opts.stripeCustomerId;
  }
  if (opts?.stripeSubscriptionId !== undefined) {
    patch.stripeSubscriptionId = opts.stripeSubscriptionId;
  }
  await mergeClerkPublicMetadata(clerkUserId, patch);
}
