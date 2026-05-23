import { NextRequest, NextResponse } from "next/server";
import { stripe, tierFromPriceId } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(sub);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionCanceled(sub);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const clerkUserId = session.metadata?.clerk_user_id;
  if (!clerkUserId || !session.subscription) return;

  const sub = await stripe.subscriptions.retrieve(session.subscription as string);
  await syncSubscription(sub, clerkUserId);
}

async function syncSubscription(sub: Stripe.Subscription, clerkUserIdOverride?: string) {
  const customerId = sub.customer as string;
  const priceId = sub.items.data[0]?.price.id;
  const tier = tierFromPriceId(priceId ?? "");

  // Find profile by stripe customer id
  let profileQuery = supabaseAdmin
    .from("subscriptions")
    .select("profile_id")
    .eq("stripe_customer_id", customerId)
    .single();

  let profileId: string | null = null;

  if (clerkUserIdOverride) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", clerkUserIdOverride)
      .single();
    profileId = profile?.id ?? null;
  } else {
    const { data } = await profileQuery;
    profileId = data?.profile_id ?? null;
  }

  if (!profileId) return;

  await supabaseAdmin.from("subscriptions").upsert(
    {
      profile_id: profileId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      tier,
      status: sub.status as "active" | "trialing" | "past_due" | "canceled" | "incomplete",
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      trial_end: sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null,
    },
    { onConflict: "profile_id" }
  );
}

async function handleSubscriptionCanceled(sub: Stripe.Subscription) {
  await supabaseAdmin
    .from("subscriptions")
    .update({ tier: "free", status: "canceled" })
    .eq("stripe_subscription_id", sub.id);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subId = invoice.subscription as string;
  if (!subId) return;
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subId);
}
