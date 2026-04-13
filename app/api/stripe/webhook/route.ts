import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { mergeClerkPublicMetadata, setClerkSubscriptionTier } from "@/lib/clerkStripeSync";
import { getStripe } from "@/lib/stripe";
import type { AppTier } from "@/lib/tier";
import { tierFromStripePriceId } from "@/lib/tier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function subscriptionActive(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

function tierFromSubscription(sub: Stripe.Subscription): AppTier {
  if (!subscriptionActive(sub.status)) return "free";
  const priceId = sub.items.data[0]?.price?.id;
  return tierFromStripePriceId(priceId);
}

function customerIdFromSubscription(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  return typeof c === "string" ? c : c && "id" in c ? c.id : null;
}

async function applySubscriptionToClerk(sub: Stripe.Subscription): Promise<void> {
  const clerkUserId = sub.metadata?.clerkUserId?.trim();
  if (!clerkUserId) {
    console.warn("[stripe/webhook] subscription missing clerkUserId metadata");
    return;
  }
  const tier = tierFromSubscription(sub);
  const customerId = customerIdFromSubscription(sub);
  await setClerkSubscriptionTier(clerkUserId, tier, {
    stripeCustomerId: customerId ?? undefined,
    stripeSubscriptionId: tier === "free" ? null : sub.id,
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET missing");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("[stripe/webhook] signature verify failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const stripe = getStripe();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid =
          session.metadata?.clerkUserId?.trim() ??
          session.client_reference_id?.trim();
        const customer =
          typeof session.customer === "string"
            ? session.customer
            : session.customer &&
                typeof session.customer === "object" &&
                "id" in session.customer
              ? (session.customer as { id: string }).id
              : null;
        if (uid && customer) {
          await mergeClerkPublicMetadata(uid, { stripeCustomerId: customer });
        }
        if (
          session.mode === "subscription" &&
          typeof session.subscription === "string" &&
          uid
        ) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await applySubscriptionToClerk(sub);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (event.type === "customer.subscription.deleted") {
          const clerkUserId = sub.metadata?.clerkUserId?.trim();
          if (clerkUserId) {
            const customerId = customerIdFromSubscription(sub);
            await setClerkSubscriptionTier(clerkUserId, "free", {
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: null,
            });
          }
        } else {
          await applySubscriptionToClerk(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe/webhook] handler error", event.type, e);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
