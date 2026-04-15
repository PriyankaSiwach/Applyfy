import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe";
import {
  hasProPlan,
  tierFromPublicMetadata,
  tierFromStripePriceId,
  type AppTier,
} from "@/lib/tier";

function subscriptionActive(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

function tierFromStripeSubscription(sub: Stripe.Subscription): AppTier {
  if (!subscriptionActive(sub.status)) return "free";
  const priceId = sub.items.data[0]?.price?.id;
  return tierFromStripePriceId(priceId);
}

function betterTier(a: AppTier, b: AppTier): AppTier {
  const rank: Record<AppTier, number> = { free: 0, pro: 1, premium: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Tier from Clerk `publicMetadata.subscriptionTier`, then Stripe when metadata
 * still says `free` (missed/stale webhooks). Clerk holds Stripe customer/sub ids
 * written by the checkout + webhook handlers — not a separate DB.
 */
export async function effectiveTierFromClerkPublicMetadata(
  publicMetadata: Record<string, unknown> | null | undefined,
): Promise<AppTier> {
  const meta = publicMetadata ?? {};
  const fromMeta = tierFromPublicMetadata(meta);
  if (hasProPlan(fromMeta)) return fromMeta;

  if (!process.env.STRIPE_SECRET_KEY?.trim()) return fromMeta;

  try {
    const stripe = getStripe();
    const subId =
      typeof meta.stripeSubscriptionId === "string"
        ? meta.stripeSubscriptionId.trim()
        : "";
    const custId =
      typeof meta.stripeCustomerId === "string" ? meta.stripeCustomerId.trim() : "";

    let best: AppTier = fromMeta;

    if (subId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        best = betterTier(best, tierFromStripeSubscription(sub));
      } catch {
        /* stale or invalid id */
      }
    }

    if (custId && !hasProPlan(best)) {
      const list = await stripe.subscriptions.list({
        customer: custId,
        limit: 15,
      });
      for (const sub of list.data) {
        if (subscriptionActive(sub.status)) {
          best = betterTier(best, tierFromStripeSubscription(sub));
        }
      }
    }

    return best;
  } catch (e) {
    console.warn("[effectiveTierFromClerkPublicMetadata] Stripe lookup failed", e);
    return fromMeta;
  }
}
