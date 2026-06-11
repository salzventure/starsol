# StarSol Google TV Full Verification Prompt

Use this prompt for a final bug bash before Google Play submission. Run it against the installed Google TV app on real hardware, not only a browser.

```text
You are an adversarial QA lead verifying StarSol for Google TV and the paired website before launch. Be skeptical, thorough, and evidence-driven. Do not assume a feature works because one happy path worked. Use a real Google TV/Chromecast device, the current APK, the production website, backend logs, and screenshots/video evidence.

Target product:
- App: StarSol Google TV
- Package: app.starsol.tv
- Website: https://starsol.app
- TV receiver: bundled file:///android_asset/receiver/index.html
- Billing provider on TV: Google Play Billing
- Web billing provider: Stripe
- Auth providers: email/password, Google, Apple, TV pairing

Launch-readiness rule:
- Mark PASS only if the feature works repeatedly from a clean state and survives navigation, app restart, network hiccups, and account-state changes.
- Mark BLOCKER if a user can pay but not receive entitlement, can receive entitlement without valid payment, gets stuck without a recovery path, sees broken Google/OAuth/payment UI, or cannot navigate with D-pad.
- Mark HIGH if a paid or gated feature is confusing, clipped, unreachable, or inconsistent between TV and web.
- Mark MEDIUM/LOW for polish issues that do not block launch.

Evidence required:
- Device model, Android version, APK version/build hash, date/time, and tester account.
- Screenshots of every major TV screen at 1920x1080 and, if available, 1280x720.
- ADB logs around auth, pairing, billing, playback, restore, and errors.
- Backend logs for device registration, bootstrap checkout, pairing, auth/me, Play verify, RTDN, Stripe checkout, and webhook paths.
- Database rows or admin screenshots proving final user plan/effectivePlan, play_subscriptions, subscriptions, and devices state.
- List every defect with exact reproduction steps, expected result, actual result, severity, and whether it was fixed.

Start from clean states:
1. Uninstall the TV app and reinstall the APK.
2. Clear app data and relaunch.
3. Test with no StarSol token, guest state, paired free account, paired Explorer account, paired Observer account, and a Google Play account with no prior subscription.
4. Repeat at least one pass after force-stopping and relaunching the app.
5. Repeat at least one pass with Wi-Fi temporarily disconnected or backend unavailable.

TV navigation and screen coverage:
1. Splash and welcome:
   - App opens without blank/white screen.
   - Focus appears on a usable control.
   - D-pad up/down/left/right never traps focus invisibly.
   - Back behavior is predictable.
   - Guest browsing works.
   - Sign-in/pairing entry works.
2. Pairing:
   - Pairing code is readable from couch distance.
   - QR code works and falls back gracefully if QR rendering fails.
   - Code expires and refreshes without stale polling bugs.
   - Web pairing at starsol.app/pair links the TV to the signed-in account.
   - After pairing, the TV receives a token, sidebar name/plan updates, and app goes to the expected screen.
   - Pairing an already paired device behaves intentionally and does not silently orphan paid entitlements.
3. Sidebar/global nav:
   - Every nav item is reachable with D-pad.
   - Active state matches current screen.
   - Sidebar expands/collapses cleanly.
   - Search opens and closes without stealing focus permanently.
4. Tonight:
   - Hero renders, clock/location render, and background rotation does not flicker.
   - ISS card opens and closes.
   - Primary video CTA opens player.
   - Free, Explorer, and Observer accounts see correct locked/unlocked copy.
5. Browse/player:
   - Featured video opens.
   - Video player loads, plays, pauses, seeks if supported, shows controls, hides controls, and returns focus to origin on Back.
   - Player handles bad media URLs and network loss without freezing.
6. Sky:
   - All sky event filters are reachable.
   - Free events open details.
   - Observer-only ISS/local viewing details are gated for free/Explorer and unlocked for Observer.
   - Date/time/localized text is not clipped.
7. Constellations:
   - Cards render and filters work.
   - Detail modal opens/closes.
   - Tour mode works or fails gracefully.
8. Gallery:
   - Tiles load thumbnails.
   - Image viewer opens, left/right works, close returns focus.
   - Slideshow starts/stops and does not continue after leaving screen.
9. Ambient:
   - Ambient starts full-screen with no distracting UI.
   - Settings appear on key press.
   - Collection/channel/sound/delay/shift controls cycle correctly.
   - Exit returns to Tonight.
   - Idle-to-ambient never triggers on welcome, pairing, pricing, lock, or player.
10. Search:
   - Keyboard is D-pad usable.
   - Search query updates results.
   - Results open the correct destination.
   - Back/close restores focus.
11. Lock/free window:
   - Fresh guest access works for the allowed window.
   - Expired guest/free window routes to lock/pricing appropriately.
   - Paid accounts are not locked out.

Pricing and Google TV payment UX:
1. Pricing screen:
   - Annual is selected by default.
   - Explorer shows a large monthly-equivalent price of $3.33 / mo and a smaller “Billed $39.99 annually” line.
   - Observer shows a large monthly-equivalent price of $5.42 / mo and a smaller “Billed $64.99 annually” line.
   - Switching to Monthly shows Explorer $4.99 / mo, Observer $7.99 / mo, and “Billed monthly.”
   - Switching back to Annual restores annual default values.
   - Only two plan cards are shown; no dense four-card payment wall.
   - Restore and continue-free are reachable but visually secondary.
   - No text overlap, clipping, nested-card look, or tiny legal copy from normal couch distance.
2. Unauthenticated checkout:
   - From a clean install with no token, choose a paid plan.
   - The app creates/reuses a TV checkout account via /api/devices/bootstrap-checkout before launching Google Play.
   - The app stores a JWT locally and clears guest mode.
   - The purchase flow launches after account bootstrap.
   - If bootstrap fails, the user sees a clear retry/pairing message and no purchase is launched.
3. Authenticated checkout:
   - Paired free account can start Explorer and Observer purchases.
   - Existing paid account sees sensible behavior if it tries to buy a lower/equal/higher tier.
4. Google Play purchase verification. Use real Play test products and test accounts:
   - Products exist and match IDs: explorer_monthly, explorer_annual, observer_monthly, observer_annual.
   - Purchase returns productId and purchaseToken to the WebView.
   - TV posts productId and purchaseToken to /api/play-billing/verify with Authorization bearer token.
   - Backend verifies token with Google Android Publisher API before granting access.
   - Backend stores token hash only, not raw token.
   - Backend rejects unknown product IDs.
   - Backend rejects duplicate purchase token claimed by a different user.
   - Android app acknowledges purchase only after backend verify returns ok.
   - If backend verify fails, purchase is not acknowledged and user is told verification failed.
   - After success, /api/auth/me returns effectivePlan matching the purchased tier.
   - TV updates sidebar plan, unlocks paid content, and survives app restart.
5. Restore:
   - Restore works for logged-in paired accounts.
   - Restore works from clean unauthenticated state by bootstrapping a TV account first.
   - Restore with no purchases shows a non-scary message.
   - Restore with expired/canceled subscription does not unlock paid access.
6. RTDN/backend:
   - Google RTDN endpoint validates Pub/Sub bearer token/audience.
   - Renewal, cancellation, grace period, hold, pause, and expiration update play_subscriptions and effective plan correctly.
   - Expired Google Play entitlement demotes only when no Stripe entitlement still grants the tier.

Website/auth/payment coverage:
1. Website loads with current CSP, no console-blocked Google, Apple, Turnstile, Stripe, or image assets.
2. Email signup requires Turnstile where configured, creates account, logs in, and shows dashboard.
3. Email login/logout/reset flows work.
4. Google Sign-In works with the configured GOOGLE_CLIENT_ID and does not rely on stale redirect env vars.
5. Apple Sign-In works, including callback and account linking.
6. OAuth account creation respects the intended signup gate.
7. Web account page shows correct effective plan across Stripe and Google Play.
8. Stripe checkout works only on web/phone/desktop, not inside TV WebView.
9. Stripe portal opens for Stripe subscribers.
10. Legal/privacy/terms pages mention actual processors: Stripe, Google Play, OAuth, Turnstile, analytics if present.

Entitlement matrix:
- Free: free Tonight, basic sky, limited gallery/browse; no Observer local tools.
- Explorer: Webb gallery, ambient mode, astronomy videos, constellation guides, ISS live tracker, sky calendar.
- Observer: everything in Explorer plus local ISS pass planning and aurora/moon/cloud/viewing context.
- Institutional/admin: highest tier behavior without breaking consumer UI.

Adversarial tests:
1. Rapidly press D-pad and Enter across every screen for 3 minutes.
2. Press Back repeatedly from modals, player, search, pricing, pairing, and ambient.
3. Force-stop app mid-pairing and mid-pricing, then relaunch.
4. Toggle network offline during API fetch, video playback, pairing poll, bootstrap checkout, verify, and restore.
5. Try purchase with stale token, invalid productId, duplicate token, missing Authorization, and disabled Play Billing env.
6. Change localStorage token/plan manually in debug and confirm backend-gated APIs still enforce real auth.
7. Test with long account names and generated TV account names.
8. Test overscan/safe-area on TV settings if available.
9. Leave app idle for 30 minutes and verify no memory/performance degradation or unwanted screen jump.
10. Confirm no secrets, service-account JSON, raw purchase tokens, JWTs, or private env values appear in client logs.

Final go/no-go:
- PASS only if TV navigation, pairing, unauthenticated checkout bootstrap, Google Play purchase/restore/verify, entitlement unlock, website auth, Stripe web billing, and RTDN behavior all work with evidence.
- NO-GO if payments can launch without an account token, if verified purchases are not bound to a user, if failed verification acknowledges purchases, if paid content unlocks from local plan spoofing, if OAuth providers fail, or if D-pad navigation traps users.
```
