import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
  typescript: true,
});

export const PRICES = {
  explorer_monthly: process.env.STRIPE_PRICE_EXPLORER_MONTHLY!,
  explorer_annual: process.env.STRIPE_PRICE_EXPLORER_ANNUAL!,
  observer_monthly: process.env.STRIPE_PRICE_OBSERVER_MONTHLY!,
  observer_annual: process.env.STRIPE_PRICE_OBSERVER_ANNUAL!,
} as const;

// Map Stripe price ID → subscription tier
export function tierFromPriceId(priceId: string): "explorer" | "observer" | "free" {
  if (priceId === PRICES.explorer_monthly || priceId === PRICES.explorer_annual) {
    return "explorer";
  }
  if (priceId === PRICES.observer_monthly || priceId === PRICES.observer_annual) {
    return "observer";
  }
  return "free";
}
