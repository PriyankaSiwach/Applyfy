import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const pro = process.env.STRIPE_PRO_PRICE_ID;
    const premium = process.env.STRIPE_PREMIUM_PRICE_ID;
    const planRaw = (body as { plan?: unknown }).plan;
    let priceId =
      typeof (body as { priceId?: unknown }).priceId === "string"
        ? (body as { priceId: string }).priceId.trim()
        : "";
    if (!priceId && planRaw === "pro" && pro) priceId = pro;
    if (!priceId && planRaw === "premium" && premium) priceId = premium;
    const allowed = new Set([pro, premium].filter(Boolean) as string[]);
    if (!priceId || !allowed.has(priceId)) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const c = await clerkClient();
    const user = await c.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    const customerId =
      typeof user.publicMetadata?.stripeCustomerId === "string"
        ? user.publicMetadata.stripeCustomerId
        : undefined;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/my-application?checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=cancel`,
      client_reference_id: userId,
      metadata: { clerkUserId: userId },
      subscription_data: { metadata: { clerkUserId: userId } },
      ...(customerId
        ? { customer: customerId }
        : email
          ? { customer_email: email }
          : {}),
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session missing URL" },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe/checkout]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
