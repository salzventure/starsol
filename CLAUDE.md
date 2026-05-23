# StarSol

Premium astronomy streaming TV app. Roku-first, then Apple TV + Fire TV.

## Stack
- **Google TV:** Jetpack Compose for TV (Kotlin) — first and only TV platform until solid
- **Backend:** Next.js (App Router) + Supabase
- **Auth + QR pairing:** Clerk
- **Payments:** Stripe + Google Pay
- **Video (MVP):** Mux — free encoding, LL-HLS for live events
- **Video (scale):** Migrate to S3 + CloudFront at ~50K MAU
- **Email:** Resend
- **Deploy:** Vercel (backend/website)

## Key decisions
- Google TV (Jetpack Compose) is the first platform — nail it before adding Apple TV/Fire TV/Roku
- QR-to-phone pairing is the onboarding moat — Clerk handles the web side, TV shows the QR
- Ambient mode (8K JWST imagery when TV is idle) is feature #1
- Annual plan ($39.99/yr Explorer) is the primary CTA, not monthly
- Observer tier is $7.99/mo — NOT $9.99 (CuriosityStream killed $9.99 for a reason)
- No interactive star map in V1 — pre-rendered tiles only
- No native iOS/Android app in V1 — web companion only
- Admin dashboard ships alongside backend

## Tiers
- Free: limited library + ads
- Explorer: $4.99/mo or $39.99/yr — full library, ambient mode, sky alerts
- Observer: $7.99/mo or $64.99/yr — geolocated ISS/aurora alerts, early JWST drops
- Institutional: custom $1,500–$5,000/yr — planetariums, K-12, museums

## Google TV / Jetpack Compose for TV notes
- Use `androidx.tv:tv-compose` and `androidx.tv:tv-foundation` — not plain Compose
- Focusable items must use `Modifier.focusable()` or TV-specific focus APIs
- D-pad UX: ≤2 UP presses to reach header from any content row, BACK = hierarchy not close
- 150ms D-pad debounce on all inputs, focus always visible on transitions
- Test on real device via ADB — emulator focus behavior differs
- No Stellarium code (GPL viral) — use JPL Horizons for ephemeris

## Content — free public domain pipeline
- NASA imagery/video: public domain, no royalties, credit required, no logo use
- JWST/STScI: public domain with credit "NASA, ESA, CSA, STScI"
- ESO: CC BY 4.0 (VLT, ALMA, ELT footage)
- NOIRLab: CC BY 4.0
- JPL Horizons: free ephemeris API
- USNO: free eclipse/moon data
- DO NOT use Stellarium code — GPL v2/AGPL 3.0, viral license

## Domains
- StarSol.app (purchased)
- StarSol.tv (target)
