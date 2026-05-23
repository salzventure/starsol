# StarSol — Builder Prompt

Copy everything below this line into a new Claude session alongside the design files.

---

I'm handing you the design package for **StarSol**, a premium astronomy streaming TV app. The attached files are the output of a full `/new-product-buildout` design session — brand system, screen mockups (JSX), marketing website (`website.html`), backend schema sketch, and handoff README.

**Your job:** implement this as a real, shippable product — Google TV first, nothing else until it's solid.

**Repo:** `~/starsol` — read `CLAUDE.md` before touching anything.

---

## Platform: Google TV only

Build exclusively for Google TV (Android TV OS). No Roku, no Apple TV, no Fire TV until Google TV is in a good place. Don't scaffold other platforms, don't add abstractions "for later" — just Google TV.

**Stack:**
- **Google TV app:** Jetpack Compose for TV (Google's modern recommended approach)
- **Backend:** Next.js + Supabase
- **Auth + QR pairing:** Clerk (QR-to-phone is the onboarding moat — must work)
- **Payments:** Stripe
- **Video (MVP):** Mux — free encoding, LL-HLS for live events
- **Video (scale):** Migrate to S3 + CloudFront at ~50K MAU

---

## How to work: build → test → UX verify → repeat

Do not batch up large chunks of work and present them all at once. Work in tight loops:

1. **Build** a screen or feature
2. **Deploy to device via ADB** and test it yourself — don't just describe what you built
3. **UX verify** against the design file for that screen: focus states, D-pad nav, back behavior, transitions
4. **Fix what's wrong** before moving to the next screen
5. Report what passed and what needed fixing before moving on

If something doesn't feel right on the TV — navigation is awkward, focus jumps unexpectedly, text is hard to read at 10ft — flag it and fix it. Don't ship a screen you haven't navigated with a D-pad.

**ADB testing:** the project has an existing ADB-based TV testing methodology. Use `adb connect` to push builds and verify on-device. Check `~/starsol/docs/` for any device notes.

---

## Build order

1. **Backend first** — Supabase schema, Stripe subscription tiers, Clerk auth, sky events data model
2. **Onboarding** — account creation + QR pairing screen. This is the first thing a user sees; get it right before touching anything else
3. **Home dashboard** — hero + curated rows (Tonight's Sky, JWST Gallery, Series, Live Events)
4. **Ambient mode** — 8K JWST imagery when the TV is idle. This is feature #1, not a footnote
5. **Video player** — with proper D-pad controls, progress scrubbing, back behavior
6. **Sky events calendar** — "watch tonight" view
7. **Browse + search**
8. **Settings + subscription management**
9. **Marketing website** — `website.html` from design files

Go in order. Don't skip ahead.

---

## Key decisions — don't re-debate

- **QR-to-phone pairing must work.** User scans QR on TV with phone, lands on a web page, signs in, TV auto-advances. Test this end-to-end before considering onboarding done.
- **Ambient mode is feature #1.** It gets its own settings screen and its own entry in the home UI. Not a screensaver.
- **Annual plan is the primary CTA.** Explorer is $39.99/yr. Monthly exists but annual is hero.
- **Observer tier is $7.99/mo.** Not $9.99.
- **No interactive star map V1.** Pre-rendered tiles only.
- **No native mobile app V1.** Web companion only.
- **DO NOT use Stellarium code** — GPL/AGPL viral license. Use JPL Horizons for ephemeris.

---

## Tiers

| Tier | Price |
|---|---|
| Free | $0 — limited library, ads, 20 JWST images |
| Explorer | $4.99/mo or **$39.99/yr** |
| Observer | $7.99/mo or $64.99/yr |
| Institutional | Custom |

---

## Google TV / D-pad UX rules

- ≤2 UP presses to reach the header/nav from any content row
- BACK = move up the hierarchy, never close the app unexpectedly
- 150ms debounce on all D-pad inputs
- Focus state must always be visible — never leave the user guessing what's selected
- Show focus on every screen transition — don't let it land in an invisible state
- Minimum 22px body text, 14px labels — readable at 10 feet
- OLED burn-in safe on ambient screens — no static high-contrast elements held for long periods

---

## Content pipeline — free and verified

- NASA, STScI/JWST, ESO, NOIRLab: public domain or CC BY 4.0 — use real images as placeholders
- JPL Horizons (free) + USNO (free) for sky event data
- Don't use stock space images — the real NASA/ESO content looks better and is free

---

## Start here

1. Read the handoff README in the design package
2. Read `~/starsol/CLAUDE.md`
3. Ask one question if anything is unclear, then start with the Supabase schema
