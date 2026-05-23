# StarSol — Builder Handoff

Copy everything below this line into a new Claude session to start the build.

---

/new-product-buildout

## Product: StarSol

StarSol is a premium astronomy streaming TV app — JWST imagery, deep sky documentaries, space event calendars, cinematic cosmology. Think *Cosmos* (Sagan/Tyson) as a TV app. Wonder-first. Beautifully produced.

**Domain purchased:** StarSol.app. Targeting StarSol.tv.

---

## What to build

Full product buildout across three surfaces:

1. **TV app** — Roku-first (BrightScript/SceneGraph), then React Native TV for Apple TV + Fire TV
2. **Marketing website** — `website.html`, self-contained, same brand system
3. **Backend schema** — Next.js + Supabase, content model, auth, subscription tiers

---

## Stack (locked — don't re-debate)

| Layer | Choice |
|---|---|
| Roku | BrightScript / SceneGraph |
| Apple TV + Fire TV | React Native TV (tvos fork) |
| Backend | Next.js + Supabase |
| Auth + QR pairing | Clerk |
| Payments | Stripe |
| Video MVP | Mux (free encoding, LL-HLS for live) |
| Video at scale | Migrate to S3 + CloudFront at ~50K MAU |

---

## Brand

**Name:** StarSol

**Mood:** Cinematic dark UI. Deep space = the design metaphor. Not tech blue — think observatory red-light-mode, deep blacks, warm star-gold accent (#e2b96f or similar). The emotional experience of stargazing: vastness, quiet, ancient light, wonder that's almost melancholy.

**TV-first:** Everything designed for D-pad, 10ft viewing, OLED burn-in safe.

**Voice:** Reverent but not stuffy. Carl Sagan energy. Specific over vague. No emoji in UI copy.

**No AI slop:** No rainbow gradients, no generic rounded-card UI kits. Real photography placeholders (JWST images are public domain — use them).

---

## Screens to design

**TV app:**
- Onboarding: account creation → QR pairing (QR-to-phone is the moat, don't skip it)
- Home dashboard: hero featured content + curated rows (Tonight's Sky, JWST Gallery, Series, Live Events)
- Content browse + search
- Video player
- Sky events calendar ("watch tonight")
- Ambient mode settings (the killer feature — 8K JWST imagery as living art)
- Account + subscription settings

**Website:** Full marketing site with hero, features, pricing, FAQ, platform download links

**Backend:** Supabase schema for content library, subscription tiers, sky event data, user preferences

---

## Business model + pricing (validated by market research)

| Tier | Price | Key features |
|---|---|---|
| Free | $0 | 20 JWST images, 7-day sky calendar, 3 sample episodes, limited ambient |
| Explorer | **$4.99/mo or $39.99/yr** | Full library, 4K JWST gallery + narration, ambient mode, sky push alerts, live events |
| Observer | $7.99/mo or $64.99/yr | Everything + geolocated ISS/aurora alerts, early JWST drops, 8K wallpaper downloads |
| Institutional | Custom $1,500–$5,000/yr | Planetariums, K-12 STEM, science museums |

**Critical:** Annual plan ($39.99/yr Explorer) is the primary CTA — this audience over-indexes on annual prepay. $9.99/mo is a dead zone (CuriosityStream killed it). Observer is $7.99, not $9.99.

---

## Feature priorities

**#1 — Ambient mode:** 8K JWST + ESO imagery as a living art piece when the TV is idle. Apple TV Aerials is the proof-of-behavior. This is the dinner-party hook and highest tell-a-friend potential.

**#2 — Geolocated "Look Up Now":** Push notification: "ISS overhead in 4 min, look SW." Star Walk and Sky Guide both report 3–4x retention lift for notification users. Companion mobile push → TV is the destination when they come back inside.

**#3 — Live event watch parties:** Launches, eclipses, JWST drops with expert commentary overlays. SpaceX IFT-3 hit 5.7M concurrent on bare YouTube — packaged TV experience is a clear step up.

---

## Content — free public domain pipeline

All of this is verified free for commercial use:

| Source | Content | License |
|---|---|---|
| NASA | All mission imagery + video | Public domain |
| STScI (JWST/Hubble) | Webb + Hubble imagery | Public domain + credit line |
| ESO | VLT, ALMA, ELT, 4K B-roll | CC BY 4.0 |
| NOIRLab | Gemini, Rubin Observatory | CC BY 4.0 |
| JPL Horizons | Solar system ephemeris | Free/PD |
| USNO | Eclipse, moon, rise/set data | Free/PD |

**DO NOT use Stellarium code** — GPL v2 / AGPL 3.0 (viral). Use JPL Horizons + custom rendering instead.

---

## Roku-specific gotchas (from prior experience)

- BrightScript has reserved words that will silently break things — check before naming variables
- Deploy-while-running blocks port 80 — kill the running channel before deploying
- InitGlobalContext ordering: set globals before any component tries to use them
- Roku certification: 2–6 weeks elapsed — build the cert submission into the timeline
- D-pad UX rules: ≤2 UP presses to reach header from any content row, BACK = hierarchy navigation, 150ms debounce on all D-pad inputs, always show focus state on screen transitions

---

## What to skip in V1

- Native iOS/Android apps (web companion only)
- Interactive star map (pre-rendered tiles only in V1)
- Social / community features
- Telescope hardware integrations
- Offline downloads
- International (US-first)

---

## Competitive context (don't design in a vacuum)

- **NASA+** is free, ad-free, on all platforms. The objection every user will have. Answer: cinematic storytelling + curation + ambient mode + live events. NASA+ will never build those.
- **MagellanTV** (~$6.99/mo) is the closest paid competitor — strong content, zero brand identity, stale UX. StarSol's moat is brand + design + curation.
- **CuriosityStream** ($4.99/mo) is the cautionary tale — went broad, pivoted to B2B. StarSol stays astronomy-only.
- **The gap:** No paid service focuses on astronomy as a brand. The premium cinematic slot is open.

---

## Deliverables expected

1. Research synthesis → 6–8 design principles baked into the canvas
2. Brand commit — logo directions, color tokens, type, voice rules
3. All TV screens (onboarding, dashboard, browse, player, events, ambient, settings)
4. Marketing website (`website.html`)
5. Backend schema sketch (Supabase tables, subscription tiers, sky event integration)
6. Screenshots harness + batch capture
7. Handoff README + zipped package for download

**Work under the StarSol name throughout. Star-gold accent, not blue. Design for 10-foot first.**
