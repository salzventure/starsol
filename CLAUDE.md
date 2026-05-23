# StarSol

Premium astronomy streaming TV app. Roku-first, then Apple TV + Fire TV.

## Stack
- **Roku:** BrightScript / SceneGraph
- **Apple TV + Fire TV:** React Native TV (tvos fork)
- **Backend:** Next.js + Supabase
- **Auth + QR pairing:** Clerk
- **Payments:** Stripe
- **Video (MVP):** Mux — free encoding, LL-HLS for live events
- **Video (scale):** Migrate to S3 + CloudFront at ~50K MAU

## Key decisions
- Roku is the first platform to ship — nail it before adding ATV/Fire
- QR-to-phone pairing is the onboarding moat — Clerk handles the web side, Roku shows the QR
- Ambient mode (8K JWST imagery when TV is idle) is feature #1
- Annual plan ($39.99/yr Explorer) is the primary CTA, not monthly
- Observer tier is $7.99/mo — NOT $9.99 (CuriosityStream killed $9.99 for a reason)
- No interactive star map in V1 — pre-rendered tiles only
- No native iOS/Android app in V1 — web companion only

## Tiers
- Free: limited library + ads
- Explorer: $4.99/mo or $39.99/yr — full library, ambient mode, sky alerts
- Observer: $7.99/mo or $64.99/yr — geolocated ISS/aurora alerts, early JWST drops
- Institutional: custom $1,500–$5,000/yr — planetariums, K-12, museums

## Roku-specific notes (from prior projects)
- BrightScript reserved words will bite you — check before naming variables
- Deploy-while-running blocks port 80 — kill the running channel first
- InitGlobalContext ordering matters — set globals before any component uses them
- Roku certification takes 2–6 weeks elapsed — start early
- D-pad UX: ≤2 UP presses to reach header from any content row, BACK = hierarchy not close

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
