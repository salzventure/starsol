import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, PRICES } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const schema = z.object({
  plan: z.enum(["explorer_monthly", "explorer_annual", "observer_monthly", "observer_annual"]),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { plan, success_url, cancel_url } = parsed.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Get or create Stripe customer
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, subscriptions(stripe_customer_id)")
    .eq("clerk_user_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let customerId = profile.subscriptions?.[0]?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      metadata: { clerk_user_id: userId, profile_id: profile.id },
    });
    customerId = customer.id;

    await supabaseAdmin.from("subscriptions").upsert(
      { profile_id: profile.id, stripe_customer_id: customerId, tier: "free", status: "active" },
      { onConflict: "profile_id" }
    );
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card", "google_pay"],
    mode: "subscription",
    line_items: [{ price: PRICES[plan], quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { clerk_user_id: userId },
    },
    success_url: success_url ?? `${appUrl}/account?checkout=success`,
    cancel_url: cancel_url ?? `${appUrl}/pricing`,
    allow_promotion_codes: true,
    metadata: { clerk_user_id: userId },
  });

  return NextResponse.json({ url: session.url });
}
