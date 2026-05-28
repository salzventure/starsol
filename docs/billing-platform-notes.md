# StarSol Billing Platform Notes

## Google TV / Android TV

Use Google Play Billing for any subscription or paid digital access initiated inside the Google Play-distributed app.

- Products: `explorer_monthly`, `explorer_annual`, `observer_monthly`, `observer_annual`.
- Native app launches Play Billing.
- Web receiver never links Google TV users to Stripe or external checkout.
- Backend verifies purchase tokens through the Google Play Developer API before granting entitlement.
- Backend accepts restored Play purchases through the same verification path.

## Web

Web subscriptions may continue to use Stripe. Web-paid users can sign in on TV and receive entitlement from the StarSol backend, but the Google TV app must not steer users to Stripe for purchase.

## LG / Samsung Later

Do not start LG or Samsung billing work until Google TV is polished and policy-clean.

Expected differences:

- LG and Samsung app stores may require their own in-app purchase SDKs or may permit web/account billing depending on their current store rules and distribution model.
- Treat each store as a separate policy review before implementation.
- Do not reuse Google Play purchase UI/copy unless that store explicitly supports the same wording and flow.
- Keep backend entitlement source-agnostic: `stripe`, `google_play`, and later `lg_store` / `samsung_store` should all resolve to the same StarSol plan model.
