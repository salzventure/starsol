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
- Institutional: custom $1,500–$5,000/yr

## Design tokens (from handoff — do not deviate)
- space0: `#050608` — void, ambient mode, splash only
- space1: `#0a0d12` — primary background
- space2: `#11151c` — surface
- space3: `#1a2029` — elevated / cards
- space4: `#232a36` — borders / hairlines
- star100: `#fbf3df` — primary text (warm white)
- star300: `#c8b886` — secondary accent text
- star500: `#d4a44a` — PRIMARY brand accent: focus rings, buttons, brand only
- star600: `#f0c668` — hover / highlight
- ember: `#c14a2a` — LIVE indicator ONLY, nowhere else
- aurora: `#5da888` — "visible tonight" / ISS pass ONLY, nowhere else
- Fonts: Instrument Serif italic (display/headlines), Geist 300/400/500 (UI/body), JetBrains Mono (captions/data/credits)

## Logo
- Primary: Direction D — Asterism. Six-star constellation, thin connecting lines.
  Brightest (lower-left) = Sol. Second brightest (upper-right) = Polaris.
  Works from 40px app icon to 200px hero. SVG inline, no raster.

## TV nav (left rail / SideBar)
- 280px expanded, collapses to 96px (icon-only) when D-pad focus leaves the rail
- Items: Tonight · Watch · Sky · Constellations · Gallery · Ambient · Search
- Active item: 2px star-gold left border + rgba(212,164,74,0.06) background
- Constellations is a first-class nav item — charts + mythology + history + "spot tonight"

## Key screens
- Splash: starfield CSS bg + logo + wordmark + thin gold progress bar (38% wide)
- Welcome: full-bleed JWST Carina hero, "The sky is showing." at 132px serif italic
  Two buttons: "Sign in with phone" (primary) + "Browse as guest" (secondary)
- QR Pair: split — left has steps + 6-letter code in tall mono boxes; right has QR panel
  Companion URL shown on TV: starsol.tv/pair (not starsol.app/pair)
- Tonight (Home): full-bleed image + ISS/event hero at 124px italic + metadata card + sky row
- Sky Calendar: table, 90 days ahead, geolocated

## Companion web app
- URL shown on TV: starsol.tv/pair — handles QR pairing + account + Stripe checkout
- Google Pay handled natively on TV; everything else goes through companion web — planetariums, K-12, museums

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
