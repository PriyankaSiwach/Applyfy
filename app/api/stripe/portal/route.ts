import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const c = await clerkClient();
    const user = await c.users.getUser(userId);
    const customerId =
      typeof user.publicMetadata?.stripeCustomerId === "string"
        ? user.publicMetadata.stripeCustomerId
        : undefined;
    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer on file. Subscribe from Pricing first." },
        { status: 400 },
      );
    }
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/my-application`,
    });
    if (!session.url) {
      return NextResponse.json(
        { error: "Portal session missing URL" },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe/portal]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Portal failed" },
      { status: 500 },
    );
  }
}
