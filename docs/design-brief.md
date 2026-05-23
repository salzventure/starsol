# StarSol — Design Brief for Claude

**Invoke with `/new-product-buildout` and paste this entire brief.**

---

## What this is

**StarSol** is a premium TV streaming app centered on astronomy content — deep sky imagery, JWST releases, cosmology explainers, real-time sky events, and cinematic space documentary. Think the spiritual successor to Carl Sagan's *Cosmos* as a TV app: wonder-first, scientifically grounded, beautifully presented.

Primary surface is the **10-foot TV experience** (Roku, Apple TV, Fire TV, Samsung/LG smart TVs). Secondary surfaces: marketing website and companion web experience. Backend API serves all surfaces.

**Domain:** StarSol.app (purchasing). Working on StarSol.tv.

---

## Audience

- Adults 25–55 who watched *Cosmos*, follow NASA social, subscribe to Sky & Telescope
- Cord-cutters who want something that isn't Netflix noise
- Casual stargazers and dark sky enthusiasts
- Science educators (secondary audience, potential institutional tier)

Not: hardcore amateur astronomers with telescopes. This is for the *curious*, not the expert.

---

## Content model

- **Curated video library** — documentaries, NASA/ESO/JWST footage, explainers
- **Sky events calendar** — eclipses, conjunctions, meteor showers surfaced as "watch tonight"
- **Deep dives** — episodic series (black holes, exoplanets, Mars missions)
- **Live & scheduled** — space launches, telescope events, ISS passes
- **JWST / image gallery** — high-res imagery browseable on TV canvas
- **Ambient mode** — 8K JWST + ESO imagery as a living art piece (the killer feature)

---

## Business model

Freemium → subscription. Confirmed tiers from market research:
- **Free** — limited library + ads (critical for funnel)
- **Explorer** (~$4.99/mo or $39.99/yr) — full library, no ads, ambient mode, sky alerts
- **Observer** (~$7.99/mo or $64.99/yr) — geolocated ISS/aurora alerts, early JWST drops, 8K downloads
- **Institutional** (custom $1,500–$5,000/yr) — planetariums, K-12 STEM, science museums

**Key pricing insight from research:** $9.99/mo is a dead zone (CuriosityStream killed it). Annual plan is critical — this audience over-indexes on annual prepay. Push the $39.99/yr Explorer as the primary CTA.

---

## Brand direction

**Name:** StarSol

**Mood:** Cinematic dark UI. Deep space is the design metaphor. Not "tech blue" — think observatory red-light-mode, deep blacks, warm star-gold accent. The emotional experience of stargazing: vastness, quiet, ancient light, wonder that's almost melancholy.

**Density:** Editorial, not dense. Big imagery, generous whitespace. Text as caption not UI chrome.

**TV-first:** Everything designed for D-pad navigation, 10ft viewing, OLED-safe (burn-in awareness on ambient screens).

**Voice:** Reverent but not stuffy. Carl Sagan energy. Specific over vague. No clickbait ("You won't BELIEVE what JWST found"). No emoji in copy.

**No AI slop:** No rainbow gradients, no rounded-card-with-gradient-icon UI kit vibes. Real photography placeholders. If a screen is about the Pillars of Creation, show the Pillars of Creation.

**Logo directions to explore:** Sol = sun/star; Star = obvious but combinable. The name has warmth and clarity — "Sol" evokes Latin (sun, alone, ground), "Star" needs no explanation. Logo should work as a wordmark at TV distance and as an app icon at 60px.

---

## Surfaces to design

1. **TV app** (primary) — onboarding (QR pairing is the moat), home dashboard, content browse, player, sky events, ambient mode, settings
2. **Marketing website** — standalone `website.html`, same brand system
3. **Backend/API sketch** — data model, content schema, auth, subscription gates (schema + endpoint sketch in README)

---

## Stack (be efficient — this is a lean indie product)

- **TV app:** BrightScript/SceneGraph for Roku (Roku-first), React Native TV for Apple TV + Fire TV
- **Web/backend:** Next.js + Supabase
- **Auth + QR pairing:** Clerk (QR-to-phone pairing is the TV onboarding moat)
- **Payments:** Stripe (already integrated on related projects)
- **Video (MVP):** Mux (free encoding, LL-HLS for live events)
- **Video (scale):** Migrate to S3 + CloudFront at ~50K MAU

---

## Key design decisions pre-made (don't re-debate these)

- **Ambient mode is feature #1** — not a footnote. It should get its own section in every screen's consideration. This is the dinner-party hook.
- **Geolocated sky alerts are the retention lever** — Star Walk and Sky Guide both show 3–4x retention lift for notification users. Build the companion mobile push into the subscription value prop.
- **Annual plan is the primary CTA** — not monthly. $39.99/yr Explorer should be the hero option on the pricing screen.
- **Observer is $7.99, not $9.99** — CuriosityStream killed $9.99 for a reason. $7.99 with clear differentiation.
- **No interactive star map in V1** — pre-rendered tiles only. Interactive D-pad star map is V2.
- **Live events = Pro gating** — launches, eclipses, JWST drops are Observer-tier or special events.

---

## What to skip for V1

- Native iOS/Android apps (web companion only — no app store submission for mobile)
- Social features
- User-generated content
- Telescope hardware integrations
- Offline downloads (V2)
- Interactive star map (V2)

---

## Competitive context (from market research)

- **NASA+** is free, ad-free, on all platforms since Nov 2023 — the objection every subscriber will voice. Answer: cinematic storytelling + curation + live events + ambient mode. NASA+ won't build any of those.
- **MagellanTV** ($6.99/mo) is the closest paid competitor — strongest content but zero brand identity and UX complaints. StarSol's differentiator is brand + design + curation, not catalog size.
- **CuriosityStream** ($4.99/mo) is the cautionary tale — went broad, pivoted to B2B. StarSol stays vertical-pure (astronomy only).
- **The gap:** no paid competitor focuses on astronomy as a brand. The premium cinematic slot is open.

---

## Go/No-Go verdict from market research

**GO WITH CAVEATS — 54/80.** Viable as a capital-efficient bootstrap. Y3 ARR ceiling ~$25–35M (lifestyle/bootstrap territory, not VC-scale). The niche gap is real. Economics are lean.

---

## Deliverables expected

Full `/new-product-buildout`:
1. Research synthesis (6–8 design principles baked into the canvas)
2. Brand commit — logo directions, color tokens, type, voice rules. Use "StarSol" as the name throughout.
3. TV screens — onboarding (with QR pairing), home dashboard, content browse, player, sky events, ambient mode settings, account settings
4. Marketing website — `website.html`
5. Backend schema sketch — content types, subscription tiers, sky events API integration
6. Screenshots harness + batch capture
7. Handoff README + zipped package for download

**Work under the StarSol name throughout.** Use a warm star-gold accent color (not blue). Design for the 10-foot experience first.
