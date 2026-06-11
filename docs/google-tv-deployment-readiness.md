# Google TV Deployment Readiness

Last checked: 2026-06-11.

## Ready

- Android TV manifest declares Leanback-only distribution, touchscreen optional support, a TV banner, and `LEANBACK_LAUNCHER`.
- WebView shell is fullscreen, keeps the screen awake, blocks cleartext traffic, and only enables WebView debugging in debug builds.
- Native remote handling injects DPAD, select, and media transport keys into the receiver with `key`, `keyCode`, and `which` values.
- Pairing QR rendering falls back to a manual pairing canvas if the QR library cannot load.
- Native Play Billing now defers purchase acknowledgement until the StarSol backend verifies and stores the Google Play entitlement.
- Account entitlement resolution now considers both Stripe and Google Play so one billing source cannot hide an active higher-tier entitlement from the other.

## Deployment blockers

- Google Play Billing product setup and backend token verification must be validated in the Play Console sandbox before release. The local `.env` checked on 2026-06-11 did not have `PLAY_BILLING_ENABLED`, `PLAY_SERVICE_ACCOUNT_JSON`, or `PLAY_PACKAGE_NAME` configured. The live server had `PLAY_BILLING_ENABLED=1` but was missing `PLAY_SERVICE_ACCOUNT_JSON`, so Google TV payments are not production-ready yet. Do not route Google TV users to Stripe or external checkout from the installed app.
- Release signing must come from gitignored `local.properties` values: `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`.
- The bundled receiver is generated from `/Users/test/starsol/receiver/index.html` by `scripts/bundle-receiver-for-androidtv.sh`; update the source receiver before building. `backend/web/tv.html` is a separate web-served copy and must be kept in sync when changing shared receiver behavior.
