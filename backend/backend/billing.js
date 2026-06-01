'use strict';

const Stripe = require('stripe');
const store = require('./store');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' });

const PRICES = {
    explorer_monthly: process.env.STRIPE_PRICE_EXPLORER_MONTHLY,
    explorer_annual:  process.env.STRIPE_PRICE_EXPLORER_ANNUAL,
    observer_monthly: process.env.STRIPE_PRICE_OBSERVER_MONTHLY,
    observer_annual:  process.env.STRIPE_PRICE_OBSERVER_ANNUAL,
};

function planFromPriceId(priceId) {
    if (priceId === PRICES.explorer_monthly || priceId === PRICES.explorer_annual) return 'explorer';
    if (priceId === PRICES.observer_monthly  || priceId === PRICES.observer_annual)  return 'observer';
    return 'free';
}

async function createCheckoutSession(user, planKey, successUrl, cancelUrl) {
    let sub = await store.subscriptions.findByUserId(user.id);
    let customerId = sub?.stripe_customer_id;

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            name: user.name,
            metadata: { starsol_user_id: String(user.id) },
        });
        customerId = customer.id;
    }

    // Trial dedup: only grant the 7-day trial if the user has never used one.
    const trialDays = (await store.users.hasUsedTrial(user.id)) ? 0 : 7;

    const appUrl = process.env.APP_URL || 'https://starsol.app';
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: PRICES[planKey], quantity: 1 }],
        subscription_data: {
            trial_period_days: trialDays,
            metadata: { starsol_user_id: String(user.id) },
        },
        success_url: successUrl ?? `${appUrl}/account?checkout=success`,
        cancel_url:  cancelUrl  ?? `${appUrl}/pricing`,
        allow_promotion_codes: true,
        metadata: { starsol_user_id: String(user.id) },
    });

    return session.url;
}

function isEntitledStatus(status) {
    return status === 'active' || status === 'trialing';
}

async function createPortalSession(user, returnUrl) {
    const sub = await store.subscriptions.findByUserId(user.id);
    if (!sub?.stripe_customer_id) return null;
    const appUrl = process.env.APP_URL || 'https://starsol.app';
    const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: returnUrl ?? `${appUrl}/account`,
    });
    return session.url;
}

// Extract canonical period start/end from a Stripe subscription. As of
// API version 2025-04-30.basil, current_period_start/end live on the
// subscription item, not the subscription root. We fall back to the legacy
// fields for resilience against older fixtures.
function periodFromStripeSubscription(stripeSub) {
    const item = stripeSub.items?.data?.[0];
    const periodStart = (item?.current_period_start ?? stripeSub.current_period_start ?? 0) * 1000;
    const periodEnd   = (item?.current_period_end   ?? stripeSub.current_period_end   ?? 0) * 1000;
    return { periodStart, periodEnd };
}

async function handleWebhook(rawBody, sig) {
    const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);

    // Idempotency: claim returns false if another worker already processed this event.
    if (!await store.stripeEvents.claim(event.id)) {
        return; // duplicate — already handled
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            if (!session.subscription) break;
            const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
            const userId = await syncSubscription(stripeSub, session.metadata?.starsol_user_id);
            // Trial granted on this checkout? Record it so they can't farm another.
            if (userId && stripeSub.trial_end) {
                await store.users.setTrialUsed(userId);
            }
            break;
        }
        case 'customer.subscription.created': {
            const stripeSub = event.data.object;
            const userId = await syncSubscription(stripeSub);
            if (userId && stripeSub.trial_end) {
                await store.users.setTrialUsed(userId);
            }
            break;
        }
        case 'customer.subscription.updated': {
            await syncSubscription(event.data.object);
            break;
        }
        case 'customer.subscription.deleted': {
            // Honor period end — store.subscriptions.cancel preserves plan
            // until current_period_end has elapsed.
            await store.subscriptions.cancel(event.data.object.id);
            break;
        }
        case 'invoice.payment_failed': {
            const subId = event.data.object.subscription;
            // Keep plan active — Stripe dunning will retry.
            if (subId) await store.subscriptions.setPastDue(subId);
            break;
        }
    }

}

async function syncSubscription(stripeSub, userIdOverride) {
    const customerId = stripeSub.customer;
    const priceId = stripeSub.items.data[0]?.price.id;
    const plan = planFromPriceId(priceId ?? '');

    let userId = userIdOverride
        ? parseInt(userIdOverride, 10)
        : (await store.subscriptions.findByStripeCustomerId(customerId))?.user_id;

    if (!userId) return null;

    const { periodStart, periodEnd } = periodFromStripeSubscription(stripeSub);
    const status = stripeSub.status;
    const cancelAtPeriodEnd = !!stripeSub.cancel_at_period_end;

    // Effective plan: active/trialing → granted; past_due → keep plan (dunning);
    // canceled or cancel_at_period_end → keep plan until periodEnd, then free.
    const now = Date.now();
    const insidePeriod = periodEnd && periodEnd > now;
    let effectivePlan;
    if (isEntitledStatus(status)) {
        effectivePlan = plan;
    } else if (status === 'past_due') {
        effectivePlan = plan;
    } else if ((status === 'canceled' || cancelAtPeriodEnd) && insidePeriod) {
        effectivePlan = plan;
    } else {
        effectivePlan = 'free';
    }

    await store.subscriptions.upsert({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId,
        plan: effectivePlan,
        status,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd,
    });
    return userId;
}

module.exports = { stripe, PRICES, createCheckoutSession, createPortalSession, handleWebhook };
