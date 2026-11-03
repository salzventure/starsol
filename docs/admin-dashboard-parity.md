# Shared admin dashboard contract

StarSol's shared admin preview is served at `/admin/v2`. The legacy `/admin` dashboard remains available until the shared version is accepted and promoted.

StockTV is the visual and interaction reference. Shared behavior includes row-click user details (with Enter/Space keyboard parity), tab/hash navigation, overview metrics, unified subscriptions, errors, invite codes, referrals, email preview/test, audit history, and lifetime/quarterly revenue reporting. Provider data that is not configured must be labeled unavailable or partial; it must never be rendered as a fabricated `$0`.

StarSol-specific operations remain the content library, ambient collection, and sky-event APIs under `/api/admin/content`, `/api/admin/ambient`, and `/api/admin/sky-events`.

## Change rule

When changing shared admin layout, navigation, row behavior, metrics, revenue, subscriptions, errors, email preview, or accessibility:

1. Apply the same change to StockTV, FlightPort, SkorTrack, and StarSol, or ask the owner before intentionally diverging.
2. Keep app-specific operations behind the shared Operations surface; do not remove them to obtain visual parity.
3. Update the shared contract test and run the app's backend/browser smoke tests.
4. Deploy to a preview URL first when replacing a legacy dashboard, then promote only after authenticated production review.

Known StarSol configuration differences are explicit: Google Play lifetime transaction history, referrals, signup invite codes, feature flags, announcements, and service credits do not currently have StarSol persistence. Their shared API surfaces report `not_configured` rather than inventing data.
