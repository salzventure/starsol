# StarSol Marketing Website — Build Specification

**Domain:** StarSol.app
**Product:** Premium astronomy streaming TV app (Google TV / Android TV)
**Brand mood:** Cinematic dark. Deep space as design metaphor. Observatory red-light-mode. The emotional experience of stargazing: vastness, quiet, ancient light, wonder that's almost melancholy.

This document is the single source of truth for three parallel build agents. Each agent owns one HTML file. All three must use the same tokens, typography, SVG constellation data, and shared section structure defined here.

---

## Launch Quality Notes

- Do not present static astronomy, finance, sports, flight, crypto, or billing values as live/current data. Any fallback data must render as unavailable, loading, or clearly labeled sample content.
- StarSol TV must not show exact ISS pass times, planet altitudes, directions, or “visible tonight” claims unless those values are calculated for the current date and user location.
- Cross-app hardcoded live-data audit started on May 28, 2026. Follow-up risks were found in SkorTrack, StockTV, FlightPort, CoinFrame, and StarSol; handle these before launch claims say “live.”

---

## 0. File Ownership

| Agent | File | Theme |
|---|---|---|
| Agent A | `v1-photo.html` | Cinematic NASA/JWST photography with constellation overlays |
| Agent B | `v2-illustrated.html` | Pure SVG illustrated constellation maps, no photos |
| Agent C | `index.html` | Combined hybrid — MAIN production page deployed to StarSol.app |

All three files live in `/Users/test/starsol/website/`. All three are single self-contained HTML files (CSS in `<style>`, JS in `<script>`, no external build step). Google Fonts loaded via `@import` in the `<style>` block.

---

## 1. Color Token System

Paste this `:root` block verbatim at the top of every page's `<style>`.

```css
:root {
  /* Backgrounds — deep space */
  --bg-void:        #05070d;   /* deepest black, page background */
  --bg-navy:        #0a0e1a;   /* primary dark navy */
  --bg-navy-2:      #0f1422;   /* elevated panels */
  --bg-navy-3:      #161c2e;   /* cards, hover surfaces */
  --bg-overlay:     rgba(5, 7, 13, 0.72);  /* scrim over imagery */
  --bg-overlay-deep:rgba(5, 7, 13, 0.88);

  /* Star gold — primary accent (warm, observatory-safe) */
  --gold:           #e2b96f;
  --gold-bright:    #f0cd8a;
  --gold-dim:       #b8945a;
  --gold-glow:      rgba(226, 185, 111, 0.45);
  --gold-line:      rgba(226, 185, 111, 0.40);
  --gold-faint:     rgba(226, 185, 111, 0.12);

  /* Observatory red — used sparingly for alerts / institutional accents */
  --red-observe:    #8a1f1f;
  --red-dim:        rgba(138, 31, 31, 0.35);

  /* Text */
  --text-primary:   #f4f1ea;   /* warm off-white, never pure white */
  --text-secondary: #b8b3a8;   /* muted warm gray */
  --text-tertiary:  #6b6a66;   /* captions, mythology copy */
  --text-dim:       #3d3d3a;   /* footer, very subtle */

  /* Star whites */
  --star-white:     #ffffff;
  --star-line:      rgba(255, 255, 255, 0.25);
  --star-faint:     rgba(255, 255, 255, 0.40);

  /* Borders */
  --border-faint:   rgba(244, 241, 234, 0.08);
  --border-gold:    rgba(226, 185, 111, 0.22);

  /* Spacing scale (8pt grid with 4pt half-steps) */
  --s-1:  4px;
  --s-2:  8px;
  --s-3:  12px;
  --s-4:  16px;
  --s-5:  24px;
  --s-6:  32px;
  --s-7:  48px;
  --s-8:  64px;
  --s-9:  96px;
  --s-10: 128px;
  --s-11: 192px;

  /* Radii — keep small. NO chunky pill UI. */
  --r-sm: 2px;
  --r-md: 4px;
  --r-lg: 6px;

  /* Motion */
  --ease-out:   cubic-bezier(0.2, 0.7, 0.2, 1);
  --ease-soft:  cubic-bezier(0.4, 0.0, 0.2, 1);
  --dur-fast:   180ms;
  --dur-med:    420ms;
  --dur-slow:   900ms;
  --dur-draw:   2400ms;   /* constellation line draw-on */
}

html, body {
  background: var(--bg-void);
  color: var(--text-primary);
  margin: 0;
  padding: 0;
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

::selection { background: var(--gold); color: var(--bg-void); }
```

**Forbidden colors:** any blue accents (#3b82f6 etc), purple/violet, rainbow gradients, pure white (#fff) for body text, generic teal/cyan. Gold and warm off-white only.

---

## 2. Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Inter:wght@300;400;500;600&display=swap');

/* Type scale — modular, slightly compressed (1.25) for cinematic density */
:root {
  --ff-display: 'Cormorant Garamond', 'Times New Roman', serif;
  --ff-body:    'Inter', system-ui, -apple-system, sans-serif;

  --fs-hero:     clamp(56px, 8vw, 132px);   /* hero H1 */
  --fs-display:  clamp(40px, 5vw, 84px);    /* section H2 */
  --fs-h3:       clamp(28px, 3vw, 44px);    /* sub-section */
  --fs-h4:       22px;                       /* card title */
  --fs-lg:       19px;                       /* lead paragraph */
  --fs-body:     16px;
  --fs-sm:       14px;
  --fs-xs:       12px;
  --fs-micro:    11px;                       /* eyebrow / nav micro */

  --lh-tight:    1.05;
  --lh-snug:     1.2;
  --lh-normal:   1.55;
  --lh-loose:    1.7;

  --ls-display:  -0.02em;     /* tighten serif slightly */
  --ls-eyebrow:  0.28em;      /* wide-tracked all-caps labels */
  --ls-nav:      0.14em;
  --ls-body:     0;
}

/* Type primitives */
.t-eyebrow {
  font-family: var(--ff-body);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-eyebrow);
  text-transform: uppercase;
  color: var(--gold);
  font-weight: 500;
}
.t-hero {
  font-family: var(--ff-display);
  font-weight: 400;
  font-size: var(--fs-hero);
  line-height: var(--lh-tight);
  letter-spacing: var(--ls-display);
  color: var(--text-primary);
}
.t-hero em {
  font-style: italic;
  font-weight: 300;
  color: var(--gold);
}
.t-display {
  font-family: var(--ff-display);
  font-weight: 400;
  font-size: var(--fs-display);
  line-height: var(--lh-snug);
  letter-spacing: var(--ls-display);
}
.t-h3 {
  font-family: var(--ff-display);
  font-weight: 500;
  font-size: var(--fs-h3);
  line-height: var(--lh-snug);
}
.t-h4 {
  font-family: var(--ff-display);
  font-weight: 500;
  font-size: var(--fs-h4);
  letter-spacing: 0.04em;
}
.t-lead {
  font-family: var(--ff-body);
  font-weight: 300;
  font-size: var(--fs-lg);
  line-height: var(--lh-loose);
  color: var(--text-secondary);
}
.t-body {
  font-family: var(--ff-body);
  font-weight: 400;
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  color: var(--text-secondary);
}
.t-caption {
  font-family: var(--ff-body);
  font-weight: 300;
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--text-tertiary);
  font-style: italic;
}
```

**Rules**
- Display serif (Cormorant) for hero, all H2/H3, constellation names, price numerals.
- Italics in Cormorant should be used for one or two words per hero — sparingly, always in gold.
- Body sans (Inter) for paragraphs, nav, CTAs, prices subtitle, micro labels.
- Body copy weight: 300 or 400 only. Never 600+ for paragraph text.
- Constellation labels: Cormorant 500, uppercase, `letter-spacing: 0.32em`, gold.

---

## 3. SVG Constellation Coordinate Data

All constellations use `viewBox="0 0 200 200"`. Coordinates are normalized so each constellation reads correctly inside a square. Positions are mythologically/astronomically accurate to the visible sky pattern (rotated/centered for composition, not equatorial coordinates).

**Star size convention by magnitude:**
- α (alpha) prominent star: `r="3.2"` filled `var(--gold)`, with glow filter
- β (beta) bright: `r="2.4"` filled `var(--gold-bright)`
- Regular bright: `r="2.0"` filled `var(--star-white)`
- Medium: `r="1.5"` filled `var(--star-white)` opacity 0.85
- Faint: `r="1.0"` filled `var(--star-white)` opacity 0.6

**Line convention:** `stroke="var(--gold-line)"` `stroke-width="0.9"` `stroke-linecap="round"` `fill="none"`. Use `var(--star-line)` for secondary/auxiliary lines.

**Reusable filter (define once per page in a hidden `<svg>` defs):**
```html
<svg width="0" height="0" style="position:absolute">
  <defs>
    <filter id="starGlow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="2.4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="starGlowSoft" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="1.2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
</svg>
```

Apply with `filter="url(#starGlow)"` on α stars.

### 3.1 Orion — `data-constellation="orion"`
```
Stars (x,y,label,magnitude):
  Betelgeuse  α   58  62   bright-red-giant (use --gold, large)
  Bellatrix   γ  142  68
  Mintaka     δ  148 104   (belt)
  Alnilam     ε  124 110   (belt)
  Alnitak     ζ  100 116   (belt)
  Saiph       κ   88 158
  Rigel       β  168 152
  Meissa      λ  100  30   (head)
  Hatsya      ι   94 144   (sword)
  Nair-al-Saif      90 156

Lines (connect):
  Betelgeuse → Bellatrix       (shoulders)
  Betelgeuse → Alnitak         (R arm to belt)
  Bellatrix  → Mintaka         (L arm to belt)
  Mintaka → Alnilam → Alnitak  (belt)
  Alnitak → Saiph              (R leg)
  Mintaka → Rigel              (L leg)
  Saiph → Rigel                (skirt)
  Alnilam → Hatsya             (sword)
  Betelgeuse → Meissa, Bellatrix → Meissa (head triangle)
```

### 3.2 Ursa Major (Big Dipper) — `data-constellation="ursa-major"`
```
Stars:
  Dubhe    α   42  62
  Merak    β   42  92
  Phecda   γ   78 102
  Megrez   δ   82  72
  Alioth   ε  112  68
  Mizar    ζ  142  58
  Alkaid   η  172  48

Lines:
  Dubhe → Merak → Phecda → Megrez → Dubhe   (bowl)
  Megrez → Alioth → Mizar → Alkaid          (handle)
```

### 3.3 Cassiopeia — `data-constellation="cassiopeia"`
```
Stars (the W lying on its side as M, centered):
  Segin     ε   40  80
  Ruchbah   δ   78 120
  Gamma     γ  100  68
  Schedar   α  130 110   (α, prominent)
  Caph      β  168  78

Lines (zigzag):
  Segin → Ruchbah → Gamma → Schedar → Caph
```

### 3.4 Cygnus (Northern Cross) — `data-constellation="cygnus"`
```
Stars:
  Deneb       α  100  30   (α tail)
  Sadr        γ  100  96   (center)
  Albireo     β  100 168   (beak)
  Gienah      ε  158  92   (R wing)
  Delta       δ   42  92   (L wing)
  Eta              100 60   (tail mid)

Lines:
  Deneb → Eta → Sadr → Albireo   (vertical spine)
  Delta → Sadr → Gienah          (horizontal wings)
```

### 3.5 Scorpius — `data-constellation="scorpius"` (17 stars, S-curve)
```
Stars:
  Acrab       β    42  44
  Dschubba    δ    62  52
  Pi-Sco      π    50  62
  Antares     α    88  78   (α — large gold)
  Tau-Sco     τ    98  88
  Epsilon     ε   112  98
  Mu1         μ   122 112
  Zeta        ζ   132 128
  Eta         η   142 144
  Theta       θ   152 154
  Iota        ι   160 162
  Kappa       κ   168 152
  Upsilon     υ   176 140
  Lambda      λ   168 124   (stinger curl)
  Shaula            172 110
  Sigma             80  68
  Rho               58  50

Lines (head triangle, body, curving tail):
  Acrab → Dschubba → Pi-Sco → Acrab     (head)
  Dschubba → Sigma → Antares
  Antares → Tau → Epsilon → Mu1 → Zeta → Eta → Theta → Iota → Kappa → Upsilon → Lambda → Shaula
```

### 3.6 Leo — `data-constellation="leo"` (sickle + triangle)
```
Stars:
  Regulus     α    52 130   (α, large gold)
  Eta         η    62 110
  Algieba     γ    74  88
  Adhafera    ζ    72  70
  Mu          μ    82  56
  Epsilon     ε    62  56
  Zosma       δ   132  72
  Chertan     θ   142  92
  Denebola    β   172  82   (tail)

Lines:
  Regulus → Eta → Algieba → Adhafera → Mu → Epsilon → Adhafera   (sickle / backwards question mark)
  Algieba → Zosma → Chertan → Regulus                            (body triangle)
  Zosma → Denebola                                                (back to tail)
  Chertan → Denebola
```

### 3.7 Gemini — `data-constellation="gemini"` (twins, parallel lines)
```
Stars:
  Castor      α    58  40   (α twin head)
  Pollux      β   132  52   (α twin head — also large gold)
  Tau          τ    62  68
  Epsilon      ε    74  88
  Mu           μ    68 108
  Mebsuta              82 124
  Mekbuda              90 142
  Alhena              112 158   (foot)
  Tejat               54 132
  Wasat        δ   118  90
  Upsilon      υ   124 110
  Kappa        κ   146 122
  Alzirr              152 156   (foot)

Lines (two parallel stick figures):
  Castor → Tau → Epsilon → Mu → Tejat → Mebsuta → Mekbuda → Alhena
  Pollux → Wasat → Upsilon → Kappa → Alzirr
  Castor → Pollux   (shoulders connector)
```

### 3.8 Taurus — `data-constellation="taurus"` (V-shape Hyades + Aldebaran)
```
Stars:
  Aldebaran   α    98 118   (α eye — large gold-red)
  Epsilon     ε    78 102   (V upper-left)
  Gamma       γ   118 102   (V upper-right)
  Delta1      δ    86 110
  Theta       θ   108 110
  Elnath      β    42  48   (β, north horn tip)
  Zeta             158  72   (south horn tip)
  Tau              132  86
  Lambda       λ   68 138
  Omicron      ο   54 152

Lines (V Hyades + horns):
  Epsilon → Delta1 → Aldebaran → Theta → Gamma → Epsilon   (V face)
  Epsilon → Elnath                                          (north horn)
  Gamma → Tau → Zeta                                        (south horn)
  Aldebaran → Lambda → Omicron                              (lower jaw, optional)
```

**Pleiades cluster (decorative, optional add for Taurus panel):** 6 small dots clustered at (50, 70), (54, 66), (58, 72), (52, 76), (60, 68), (56, 74) — all `r="0.9"` `fill="var(--star-faint)"`.

### 3.9 Constellation panel template (reuse across V2 + V3)

```html
<article class="constellation-panel" data-constellation="orion">
  <svg viewBox="0 0 200 200" class="const-svg" aria-hidden="true">
    <g class="const-lines" stroke="var(--gold-line)" stroke-width="0.9"
       stroke-linecap="round" fill="none">
      <!-- <polyline points="58,62 142,68" /> etc -->
    </g>
    <g class="const-stars">
      <circle cx="58" cy="62" r="3.2" fill="var(--gold)" filter="url(#starGlow)"/>
      <!-- etc -->
    </g>
  </svg>
  <header class="const-meta">
    <h3 class="const-name t-h4">ORION</h3>
    <p class="const-myth t-caption">The Hunter — visible November through March.
       Betelgeuse, his shoulder, is a dying red supergiant 642 light-years away.</p>
  </header>
</article>
```

---

## 4. NASA / JWST Image URLs

**Primary URLs (verified stable, direct):**

| Slug | URL | Use case |
|---|---|---|
| `pillars` | `https://stsci-opo.org/STScI-01GA76Q01D09HFEV174SVMQDMV.png` | Orion section / V1 hero |
| `carina` | `https://stsci-opo.org/STScI-01GA6KKWG229M41KWK6K6HMNJM.png` | Carina section |
| `southern-ring` | `https://stsci-opo.org/STScI-01GA6KNK1JJAHFP8Y0KS8YPYGY.png` | Southern Ring |
| `stephans-quintet` | `https://stsci-opo.org/STScI-01GA6KKWKBKK2JKZQMHFQX09AF.png` | Stephan's Quintet |
| `cosmic-cliffs` | `https://stsci-opo.org/STScI-01GA6KKWHJBKPK8T9B3W6FKQRS.png` | Cosmic Cliffs / V3 main hero |

**Fallback strategy (in CSS):**
```css
.hero-photo {
  background-color: var(--bg-void);
  background-image:
    radial-gradient(ellipse at 30% 40%, rgba(226,185,111,0.15), transparent 50%),
    radial-gradient(ellipse at 70% 60%, rgba(138,31,31,0.18), transparent 55%),
    radial-gradient(ellipse at 50% 50%, rgba(15,20,34,1), var(--bg-void) 80%),
    url('https://stsci-opo.org/STScI-01GA76Q01D09HFEV174SVMQDMV.png');
  background-size: cover;
  background-position: center;
}
```
The gradient layers paint first (so if the image 404s, you still get a usable deep-space simulation). Add `onerror` JS fallback on `<img>` tags:
```html
<img src="..." onerror="this.style.display='none';this.parentElement.classList.add('photo-fallback')">
```
And `.photo-fallback` applies the same gradient stack.

**Image treatment in all uses:**
- Always apply scrim: `linear-gradient(180deg, rgba(5,7,13,0.45) 0%, rgba(5,7,13,0.0) 35%, rgba(5,7,13,0.0) 60%, rgba(5,7,13,0.92) 100%)` overlay.
- Subtle vignette: `box-shadow: inset 0 0 220px rgba(5,7,13,0.7)` on the photo container.
- Slight desaturation: `filter: saturate(0.92) contrast(1.05)`.

**Public domain credit line (required, footer):**
> Imagery: NASA / ESA / CSA / STScI. Public domain.

---

## 5. Shared Sections (HTML structure for all three pages)

### 5.1 Nav (top, fixed)

```html
<nav class="nav" role="navigation">
  <a href="/" class="nav-logo">
    <span class="nav-glyph">✦</span>
    <span class="nav-wordmark">StarSol</span>
  </a>
  <ul class="nav-links">
    <li><a href="#features">Features</a></li>
    <li><a href="#constellations">Constellations</a></li>
    <li><a href="#pricing">Pricing</a></li>
    <li><a href="#about">About</a></li>
  </ul>
  <a class="nav-cta" href="pricing.html">Start Watching</a>
</nav>
```

**Styling:**
- `position: fixed; top: 0; left: 0; right: 0; z-index: 100;`
- Initial state: `background: transparent;` `padding: var(--s-5) var(--s-7);`
- Scrolled state (JS toggles `.nav--scrolled` after 40px scroll): `background: rgba(5,7,13,0.82); backdrop-filter: blur(18px); border-bottom: 1px solid var(--border-faint); padding: var(--s-3) var(--s-7);`
- `.nav-glyph` is the `✦` Unicode glyph in `--gold`, font-size 18px, margin-right 8px.
- `.nav-wordmark`: Cormorant 500, 22px, letter-spacing 0.06em.
- `.nav-links`: Inter 13px, uppercase, letter-spacing `var(--ls-nav)`, gap `var(--s-6)`, color `var(--text-secondary)`. Hover → `var(--gold)`.
- `.nav-cta`: outlined button. `border: 1px solid var(--gold); color: var(--gold); padding: 10px 22px; font-family: Inter; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; border-radius: var(--r-sm);` Hover: `background: var(--gold); color: var(--bg-void);` transition 220ms.

### 5.2 Hero (page-specific — see §6)

### 5.3 Features section
```html
<section id="features" class="features">
  <header class="section-header">
    <span class="t-eyebrow">What you'll see</span>
    <h2 class="t-display">Four windows onto the night.</h2>
  </header>
  <div class="features-grid">
    <article class="feature">
      <span class="feature-num">01</span>
      <h3 class="t-h4">Ambient Mode</h3>
      <p class="t-body">Turn your television into an observatory window.
        Drift through Hubble and JWST imagery at the pace of starlight —
        no narration, no captions, just the quiet light of distant things.</p>
    </article>
    <article class="feature">
      <span class="feature-num">02</span>
      <h3 class="t-h4">JWST Gallery</h3>
      <p class="t-body">Every public James Webb release, in native 4K.
        Pillars of Creation. Carina. Cosmic Cliffs. Curated, annotated,
        and updated within hours of each new image drop.</p>
    </article>
    <article class="feature">
      <span class="feature-num">03</span>
      <h3 class="t-h4">Sky Events Calendar</h3>
      <p class="t-body">Meteor showers, eclipses, planetary conjunctions,
        lunar phases. Filtered for your hemisphere, your latitude,
        your bortle class. Tomorrow night, the Perseids peak at 2:14am.</p>
    </article>
    <article class="feature">
      <span class="feature-num">04</span>
      <h3 class="t-h4">Geolocated Alerts</h3>
      <p class="t-body">A push when the ISS passes overhead. An alert when
        the aurora forecast crosses Kp 6 for your latitude. Notice given
        in minutes, not hours. Step outside. Look up.</p>
    </article>
  </div>
</section>
```

**Styling:**
- Section padding: `var(--s-11) var(--s-7)`.
- `.section-header`: max-width 720px, margin-bottom `var(--s-9)`. Eyebrow above display H2.
- `.features-grid`: CSS grid `repeat(auto-fit, minmax(260px, 1fr))`, gap `var(--s-7)`. On TV/Desktop force 4 columns.
- `.feature`: padding `var(--s-6) 0`, border-top `1px solid var(--border-faint)`.
- `.feature-num`: Cormorant 300, 64px, color `var(--gold-dim)`, display block, line-height 1, margin-bottom `var(--s-4)`.

### 5.4 Constellation Showcase (signature section — page-specific styling, §6)

### 5.5 Pricing
```html
<section id="pricing" class="pricing">
  <header class="section-header center">
    <span class="t-eyebrow">Pricing</span>
    <h2 class="t-display">Begin freely. Stay if it moves you.</h2>
  </header>
  <div class="pricing-grid">
    <article class="tier tier--free">
      <h3 class="tier-name">Free</h3>
      <div class="tier-price">
        <span class="tier-price-num">$0</span>
        <span class="tier-price-sub">two days, no signup</span>
      </div>
      <ul class="tier-feats">
        <li>Full browse + watch</li>
        <li>Standard library</li>
        <li>No account required</li>
        <li>Locks after 48 hours</li>
      </ul>
      <a class="tier-cta tier-cta--ghost" href="pricing.html">Start free</a>
    </article>

    <article class="tier tier--explorer is-featured">
      <span class="tier-badge">Most chosen</span>
      <h3 class="tier-name">Explorer</h3>
      <div class="tier-price">
        <span class="tier-price-num">$4.99</span>
        <span class="tier-price-sub">/ month — or $39.99/yr</span>
      </div>
      <ul class="tier-feats">
        <li>Full library, unlimited</li>
        <li>4K JWST gallery</li>
        <li>Ambient mode</li>
        <li>Sky alerts</li>
      </ul>
      <a class="tier-cta tier-cta--solid" href="pricing.html">Start Watching</a>
    </article>

    <article class="tier tier--observer">
      <h3 class="tier-name">Observer</h3>
      <div class="tier-price">
        <span class="tier-price-num">$7.99</span>
        <span class="tier-price-sub">/ month — or $64.99/yr</span>
      </div>
      <ul class="tier-feats">
        <li>Everything in Explorer</li>
        <li>Geolocated ISS &amp; aurora alerts</li>
        <li>Early JWST drops</li>
        <li>8K wallpaper downloads</li>
      </ul>
      <a class="tier-cta tier-cta--ghost" href="pricing.html">Choose Observer</a>
    </article>

    <article class="tier tier--inst">
      <h3 class="tier-name">Institutional</h3>
      <div class="tier-price">
        <span class="tier-price-num">$1,500&ndash;5,000</span>
        <span class="tier-price-sub">/ year — custom</span>
      </div>
      <ul class="tier-feats">
        <li>Planetariums, K&ndash;12 STEM, museums</li>
        <li>Multi-screen license</li>
        <li>Curriculum playlists</li>
        <li>Dedicated support</li>
      </ul>
      <a class="tier-cta tier-cta--ghost" href="mailto:institutions@starsol.app">Talk to us</a>
    </article>
  </div>
</section>
```

**Styling:**
- Grid: `repeat(auto-fit, minmax(260px, 1fr))`, gap `var(--s-5)`.
- `.tier`: background `var(--bg-navy-2)`, border `1px solid var(--border-faint)`, padding `var(--s-7) var(--s-6)`, border-radius `var(--r-md)`.
- `.is-featured`: border `1px solid var(--border-gold)`, background `var(--bg-navy-3)`, subtle inner glow `box-shadow: 0 0 60px -20px var(--gold-glow), inset 0 1px 0 rgba(226,185,111,0.08)`.
- `.tier-badge`: position absolute top -10px left 24px, Inter 10px uppercase letter-spacing 0.24em, background `var(--gold)` color `var(--bg-void)`, padding 4px 10px, border-radius `var(--r-sm)`.
- `.tier-name`: Cormorant 500, 28px, margin 0 0 `var(--s-5)`.
- `.tier-price-num`: Cormorant 400, 56px, color `var(--text-primary)`, line-height 1.
- `.tier-price-sub`: Inter 13px, color `var(--text-tertiary)`, display block, margin-top `var(--s-2)`.
- `.tier-feats`: list-style none, padding 0, margin `var(--s-6) 0`. Each `li`: Inter 14px, color `var(--text-secondary)`, padding `8px 0 8px 20px`, position relative. Before pseudo `content: "✦"; color: var(--gold-dim); position: absolute; left: 0; font-size: 10px;`.
- `.tier-cta--solid`: full-width button, background `var(--gold)`, color `var(--bg-void)`, padding 14px, Inter 13px uppercase letter-spacing 0.2em, border-radius `var(--r-sm)`. Hover lift: `transform: translateY(-1px); background: var(--gold-bright);`.
- `.tier-cta--ghost`: same but `background: transparent; border: 1px solid var(--border-gold); color: var(--gold);`.

### 5.6 Footer
```html
<footer class="footer">
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="nav-logo">
        <span class="nav-glyph">✦</span>
        <span class="nav-wordmark">StarSol</span>
      </div>
      <p class="t-caption">A quiet window onto the universe, for the largest screen in your home.</p>
    </div>
    <nav class="footer-col">
      <h4 class="footer-h">Product</h4>
      <a href="pricing.html">Pricing</a>
      <a href="account.html">Account</a>
      <a href="pair.html">Pair a TV</a>
    </nav>
    <nav class="footer-col">
      <h4 class="footer-h">Platforms</h4>
      <span class="footer-platform">Google TV</span>
      <span class="footer-platform">Android TV</span>
    </nav>
    <div class="footer-col">
      <h4 class="footer-h">Credit</h4>
      <p class="t-caption">Imagery: NASA / ESA / CSA / STScI. Public domain.</p>
    </div>
  </div>
  <div class="footer-base">
    <span class="t-caption">© 2026 StarSol. StarSol.app</span>
    <span class="t-caption">Available on Google TV &amp; Android TV</span>
  </div>
</footer>
```

**Styling:** padding `var(--s-9) var(--s-7) var(--s-6)`, border-top `1px solid var(--border-faint)`. Grid `repeat(auto-fit, minmax(200px, 1fr))` gap `var(--s-7)`. `.footer-h`: Inter 11px uppercase letter-spacing 0.24em color `var(--text-tertiary)` margin 0 0 `var(--s-4)`. Links: Inter 14px color `var(--text-secondary)`, display block padding 6px 0, hover `var(--gold)`. `.footer-base`: flex space-between, padding-top `var(--s-6)`, margin-top `var(--s-7)`, border-top `1px solid var(--border-faint)`.

---

## 6. Page-Specific Hero + Showcase Specs

### 6.1 Agent A — `v1-photo.html` (Cinematic Photo)

**Concept:** Five full-bleed scrolling "moments." Each is a 100vh section with a NASA photo background, a thin SVG constellation drawn OVER the photo as an overlay, and a Sagan-esque caption strip pinned to the bottom.

**Section order:**

1. **Hero / Orion** — Pillars of Creation background + Orion constellation overlay (lower right, 320px wide).
   - Headline: *"The light reaching you tonight left its star before there were continents."*
   - Sub: *"StarSol — the night sky, on the largest screen in your home."*
   - CTA pair: "Start Watching" (solid gold) + "Watch a sample" (ghost).
2. **Carina / Cosmic Cliffs** — full-bleed Cosmic Cliffs image, no headline, just a caption strip.
   - Caption: *"CARINA — A nursery for stars, 7,600 light-years away. The cliffs are dust, the dust is the future of suns."*
3. **Features section** (shared, §5.3) — solid `var(--bg-void)` background between photo moments.
4. **Stephan's Quintet** — image, with Cygnus overlay (small, top-left).
   - Caption: *"STEPHAN'S QUINTET — Four galaxies bound by gravity, one passing through. The first JWST image of cosmic intimacy."*
5. **Constellation Showcase** — horizontal scroll-snap row of 5 photo cards (one per NASA image above), each with constellation name + Sagan-esque mythology caption at the bottom of the photo.
6. **Southern Ring** — image fills viewport, Cassiopeia overlay (top-right).
   - Caption: *"SOUTHERN RING — A dying star, 2,500 light-years off, exhaling itself into the dark."*
7. **Pricing** (shared, §5.5) — over solid `var(--bg-navy)`.
8. **Footer** (shared, §5.6).

**Photo-moment HTML pattern:**
```html
<section class="photo-moment" data-photo="pillars">
  <div class="photo-bg">
    <img src="https://stsci-opo.org/STScI-01GA76Q01D09HFEV174SVMQDMV.png"
         alt="" loading="eager" onerror="this.parentElement.classList.add('photo-fallback')">
    <div class="photo-scrim"></div>
  </div>
  <svg class="photo-const-overlay" viewBox="0 0 200 200" aria-hidden="true">
    <!-- Orion lines + stars per §3.1 -->
  </svg>
  <div class="photo-content">
    <h1 class="t-hero">The light reaching you tonight<br>
        left its star <em>before there were continents.</em></h1>
    <p class="t-lead">StarSol — the night sky, on the largest screen in your home.</p>
    <div class="cta-row">
      <a class="btn btn-solid" href="pricing.html">Start Watching</a>
      <a class="btn btn-ghost" href="#sample">Watch a sample</a>
    </div>
  </div>
  <div class="photo-caption">
    <span class="caption-label">PILLARS OF CREATION · M16 EAGLE NEBULA</span>
    <span class="caption-text">6,500 light-years distant. The columns are clouds of hydrogen and dust, lit from within.</span>
  </div>
</section>
```

**Key styles:**
- `.photo-moment`: `position: relative; min-height: 100vh; overflow: hidden;`
- `.photo-bg img`: `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: saturate(0.92) contrast(1.05);`
- `.photo-scrim`: absolute inset 0; `background: linear-gradient(180deg, rgba(5,7,13,0.55) 0%, transparent 35%, transparent 55%, rgba(5,7,13,0.95) 100%);`
- `.photo-const-overlay`: `position: absolute; right: 8%; bottom: 22%; width: 320px; height: 320px; opacity: 0.85; mix-blend-mode: screen;`
- `.photo-content`: `position: relative; z-index: 2; padding: 18vh var(--s-7) 0; max-width: 980px;`
- `.photo-caption`: `position: absolute; left: var(--s-7); bottom: var(--s-7); max-width: 480px; z-index: 3;`
  - `.caption-label`: Inter 11px uppercase letter-spacing 0.28em color `var(--gold)` display block margin-bottom 8px.
  - `.caption-text`: Cormorant 400 italic 18px color `var(--text-primary)` line-height 1.5.

### 6.2 Agent B — `v2-illustrated.html` (Illustrated Maps, NO photos)

**Concept:** A planetarium handbook. Deep void background everywhere. No raster imagery whatsoever. Hero is a large signature constellation drawn as elegant SVG. Showcase is an 8-panel grid of all constellations from §3.

**Section order:**

1. **Hero** — full-viewport with single massive Orion SVG (60vmin), centered. Tiny stars scattered across the void as ambient background (JS-generated, 200 random points, §7).
   - Eyebrow: *"A planetarium for the living room"*
   - Headline: *"Every star, drawn by hand. Named in <em>quiet gold.</em>"*
   - Lead: *"StarSol traces 88 constellations across the night. Tonight, look up."*
2. **Features** (shared, §5.3).
3. **Constellation Showcase** — 8-panel grid (4×2 on desktop/TV, 2×4 tablet, 1×8 mobile). Use the constellation panel template from §3.9 for all 8 entries: Orion, Ursa Major, Cassiopeia, Cygnus, Scorpius, Leo, Gemini, Taurus.
   - Each panel: aspect-ratio 1/1, background `var(--bg-navy)`, border `1px solid var(--border-faint)`, padding `var(--s-6)`, hover lifts the constellation lines to brighter gold + slight scale 1.02 over 320ms.
4. **Pricing** (shared, §5.5).
5. **Footer** (shared, §5.6).

**Hero star scatter (background dots, JS):** see §7.

**Constellation panel grid CSS:**
```css
.const-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--s-5);
  padding: var(--s-9) var(--s-7);
}
@media (max-width: 1100px) { .const-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .const-grid { grid-template-columns: 1fr; } }

.constellation-panel {
  position: relative;
  background: var(--bg-navy);
  border: 1px solid var(--border-faint);
  border-radius: var(--r-md);
  padding: var(--s-6);
  aspect-ratio: 1 / 1.15;
  display: flex;
  flex-direction: column;
  transition: transform var(--dur-med) var(--ease-out),
              border-color var(--dur-med) var(--ease-out);
}
.constellation-panel:hover {
  transform: translateY(-3px);
  border-color: var(--border-gold);
}
.constellation-panel:hover .const-lines { stroke: var(--gold-bright); }
.const-svg { flex: 1; width: 100%; height: auto; }
.const-name {
  letter-spacing: 0.32em;
  color: var(--gold);
  margin: var(--s-4) 0 var(--s-2);
  text-align: center;
}
.const-myth { text-align: center; }
```

### 6.3 Agent C — `index.html` (Combined — production page)

**Concept:** The hero merges both treatments. Real NASA photo background (Cosmic Cliffs, the most painterly), with a large illustrated SVG constellation drawn directly over the top in gold. Below: V2-style illustrated feature cards. Below that: a horizontal photo gallery in V1 style. Then pricing, footer.

**Section order:**

1. **Hero** — Cosmic Cliffs background image + large illustrated Orion SVG overlay (480px) on right side at 60% opacity using `mix-blend-mode: screen`. Headline left-aligned.
   - Eyebrow: *"Premium astronomy for Google TV"*
   - Headline: *"The night sky deserves <em>your largest screen.</em>"*
   - Lead: *"StarSol streams ambient cosmos, 4K JWST imagery, and live sky alerts to your Google TV or Android TV. Two days free. No signup."*
   - CTA row: "Start Watching" (solid gold) + "Browse Constellations" (ghost, anchors to #constellations).
   - Scroll cue at bottom: small `↓` glyph in gold-dim, gentle 2.4s float animation.
2. **Features** (shared §5.3) — illustrated mini-constellation icon next to each feature number (use Cassiopeia for #01, Leo for #02, Scorpius for #03, Cygnus for #04 — 60px SVGs).
3. **Constellation Showcase** — Use V2's 8-panel grid (§6.2), introduced with eyebrow + display H2:
   - Eyebrow: *"Catalogued"*
   - H2: *"Eight you can find tonight."*
4. **Content showcase (photo gallery)** — V1-style horizontal scroll-snap row of 5 cards, one per NASA image. Each card: 520×680 photo, caption strip overlaid at bottom (label + Sagan-esque text). Scroll horizontally with momentum.
   - Eyebrow: *"From the gallery"*
   - H2: *"Light that left before us."*
5. **Pricing** (shared §5.5).
6. **About** — short reverent block, single column max-width 720px.
   - Eyebrow: *"About"*
   - H2: *"StarSol is a quiet thing."*
   - Body: *"We built StarSol because the most beautiful images of our universe deserve more than a phone screen and a thumb-scroll. On your television, in a dimmed room, they become what they are: windows. We update the gallery within hours of every public JWST release. We do not show ads. We will never show ads."*
7. **Footer** (shared §5.6).

**Hero CSS sketch:**
```css
.hero {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: grid;
  align-items: center;
}
.hero-photo {
  position: absolute; inset: 0;
  background: var(--bg-void) url('https://stsci-opo.org/STScI-01GA6KKWHJBKPK8T9B3W6FKQRS.png') center/cover no-repeat;
  filter: saturate(0.95) contrast(1.06);
}
.hero-scrim {
  position: absolute; inset: 0;
  background:
    linear-gradient(90deg, rgba(5,7,13,0.92) 0%, rgba(5,7,13,0.55) 40%, transparent 70%),
    linear-gradient(180deg, rgba(5,7,13,0.4) 0%, transparent 30%, transparent 60%, rgba(5,7,13,0.95) 100%);
}
.hero-const {
  position: absolute;
  right: 4vw; top: 50%;
  transform: translateY(-50%);
  width: min(480px, 36vw);
  height: min(480px, 36vw);
  opacity: 0.78;
  mix-blend-mode: screen;
  pointer-events: none;
}
.hero-content {
  position: relative; z-index: 3;
  padding: 0 var(--s-9);
  max-width: 760px;
}
```

---

## 7. Animation Specs

All animations respect `@media (prefers-reduced-motion: reduce)` — disable everything except instant fades to fully-rendered state.

### 7.1 Star twinkle (V2 hero ambient field, V3 hero)
JS generates 200 ambient stars on hero load, scattered as absolutely-positioned dots:
```js
const layer = document.querySelector('.star-field');
const count = 200;
for (let i = 0; i < count; i++) {
  const s = document.createElement('span');
  s.className = 'star-dot';
  const size = Math.random() < 0.85 ? 1 : (Math.random() < 0.9 ? 2 : 3);
  s.style.width = s.style.height = size + 'px';
  s.style.left = (Math.random() * 100) + '%';
  s.style.top  = (Math.random() * 100) + '%';
  s.style.opacity = (0.25 + Math.random() * 0.65).toFixed(2);
  s.style.animationDelay = (Math.random() * 6) + 's';
  s.style.animationDuration = (3 + Math.random() * 5) + 's';
  layer.appendChild(s);
}
```
```css
.star-field { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.star-dot {
  position: absolute;
  background: var(--star-white);
  border-radius: 50%;
  animation: twinkle ease-in-out infinite;
}
@keyframes twinkle {
  0%, 100% { opacity: var(--start, 0.4); transform: scale(1); }
  50%      { opacity: 0.95;              transform: scale(1.25); }
}
```

### 7.2 Constellation line draw-on
Use `stroke-dasharray` / `stroke-dashoffset` trick. On every `.const-lines polyline` and `line`:
```css
.const-lines polyline,
.const-lines line {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: drawLine var(--dur-draw) var(--ease-out) forwards;
  animation-delay: calc(var(--i, 0) * 120ms);
}
@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}
```
Trigger via IntersectionObserver — add `.is-visible` class when panel enters viewport (threshold 0.3), and only then start the animation:
```css
.constellation-panel .const-lines polyline { animation-play-state: paused; }
.constellation-panel.is-visible .const-lines polyline { animation-play-state: running; }
```
Star fade-in pops after lines complete: `.const-stars circle { opacity: 0; transition: opacity 600ms ease-out 2200ms; }` then `.is-visible .const-stars circle { opacity: 1; }`.

### 7.3 Hero parallax (V1, V3)
On `scroll`, translate the photo background up at 0.3x scroll speed, and translate the constellation overlay at 0.6x:
```js
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  document.querySelectorAll('.photo-bg').forEach(el => {
    el.style.transform = `translate3d(0, ${y * 0.3}px, 0)`;
  });
  document.querySelectorAll('.photo-const-overlay, .hero-const').forEach(el => {
    el.style.transform = `translate3d(0, ${y * -0.15}px, 0)`;
  });
}, { passive: true });
```
Wrap in `requestAnimationFrame` debounce for 60fps.

### 7.4 Fade-in on scroll (all sections)
```css
.reveal { opacity: 0; transform: translateY(20px); transition: opacity 700ms var(--ease-out), transform 700ms var(--ease-out); }
.reveal.is-visible { opacity: 1; transform: none; }
```
IntersectionObserver, threshold 0.15, add class once.

### 7.5 Nav scroll state
```js
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('nav--scrolled', window.scrollY > 40);
}, { passive: true });
```

### 7.6 Scroll cue (hero bottom on index.html)
```css
.scroll-cue { animation: float 2.4s ease-in-out infinite; }
@keyframes float {
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50%      { transform: translateY(8px); opacity: 0.9; }
}
```

---

## 8. Responsive Breakpoints

```css
/* TV / Large desktop — design target */
@media (min-width: 1600px) { /* TV-optimized — increase padding, max-width 1640px containers */ }

/* Desktop default — design baseline 1440px */

/* Tablet */
@media (max-width: 1024px) {
  /* features-grid → 2 columns
     const-grid → 2 columns
     hero padding reduced
     hero const SVG shrinks to 280px
     nav-links font-size remains, gap reduces to var(--s-4) */
}

/* Mobile */
@media (max-width: 640px) {
  /* features-grid → 1 column
     const-grid → 1 column
     pricing-grid → 1 column
     nav-links: hide; show hamburger (simple toggle)
     hero const SVG repositions below text, full-width 80vw
     photo-caption sits below image, not over it
     photo-content padding reduces
     all section vertical padding halves */
}

/* Very small */
@media (max-width: 375px) {
  /* Slightly tighter type scale,
     scroll-snap photo cards size to 86vw */
}
```

**TV-specific (1920px) overrides for `index.html`:**
- Increase hero headline cap to 156px
- Container max-width 1640px, centered
- Larger card paddings (`var(--s-7)` minimum)
- Focus rings (for TV remote): every `<a>`, `<button>` gets `:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; }`

---

## 9. Build Agent Notes

### Shared assets (every agent inlines identically)
Every page must include, in this exact order inside `<head>`:
1. `<meta charset>`, `<meta viewport content="width=device-width,initial-scale=1">`, `<title>StarSol — Astronomy for your TV</title>`, `<meta name="description" content="StarSol streams ambient cosmos, 4K JWST imagery, and live sky events to Google TV and Android TV.">`
2. `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='26' font-size='28' fill='%23e2b96f'%3E✦%3C/text%3E%3C/svg%3E">`
3. `<style>` with: Google Fonts `@import` (Cormorant + Inter), `:root` token block (§1), typography block (§2), reset, then page-specific styles.
4. `<svg width="0" height="0">` `<defs>` filters (`#starGlow`, `#starGlowSoft`) immediately after `<body>` opens.

### Shared sections (each agent copy-pastes identically)
- Nav (§5.1)
- Features (§5.3) — copy text is identical across pages
- Pricing (§5.5) — copy text identical
- Footer (§5.6) — copy text identical

Pricing tier badges/order are identical. The Explorer tier is always `.is-featured`. The "Most chosen" badge appears only on Explorer.

### Page-unique sections
- Agent A: 5 photo moments + horizontal photo scroller in showcase
- Agent B: 8-panel illustrated grid + ambient star field hero
- Agent C: hybrid hero (photo + constellation) + illustrated 8-panel grid + horizontal photo scroller + About

### Inter-page links
- Nav CTA on all pages → `pricing.html` (already exists, do not build)
- Pricing tier CTAs → `pricing.html` (Free / Explorer / Observer) or `mailto:institutions@starsol.app` (Institutional)
- Footer links: `pricing.html`, `account.html`, `pair.html` (all exist)

### Cross-agent consistency rules
- Use the `:root` tokens from §1 exactly. Do not introduce new color values.
- Use the SVG constellation coordinates from §3 verbatim — copy-paste from this doc, do not re-derive.
- Use Cormorant Garamond italics only in gold, only one phrase per headline.
- No emoji in copy. The ✦ glyph is allowed as a typographic mark (logo, bullet list, scroll cue) only.
- No external JS libraries. No CDN scripts except Google Fonts CSS. All JS is inline.
- Each HTML file must be standalone and viewable by double-clicking it (no localhost required).

### Build verification checklist (each agent before handoff)
- [ ] Page renders fully with zero console errors when opened directly
- [ ] All NASA image URLs load (or gracefully fall back to gradient)
- [ ] Cormorant Garamond + Inter both loading (check Network tab)
- [ ] All 4 pricing tiers visible, Explorer highlighted
- [ ] Nav becomes opaque after scrolling 40px
- [ ] All constellation lines draw-on once when scrolled into view
- [ ] No blue/purple/teal anywhere in the rendered output
- [ ] No rounded "pill" buttons over 6px radius
- [ ] Footer credit line "Imagery: NASA / ESA / CSA / STScI. Public domain." visible
- [ ] Resizes cleanly at 1920, 1440, 1024, 768, 375 widths
- [ ] `prefers-reduced-motion` disables animations
- [ ] Keyboard focus rings visible on every CTA in gold

### Deployment target
`index.html` (Agent C) is the file deployed to StarSol.app. The other two (`v1-photo.html`, `v2-illustrated.html`) are design alternates for review and live alongside as `/v1-photo.html` and `/v2-illustrated.html`. Existing `pricing.html`, `account.html`, `pair.html` are untouched.

### Product backlog from the latest review
- Keep pricing language synchronized everywhere the brand appears. The TV app must never drift back to one-time language; subscription, annual-first, and 7-day trial are the canonical terms.
- Replace the receiver’s curated search index with backend-backed content discovery so constellation learning, free videos, and editorial rows all point at the same source of truth.
- Seed more editorial astronomy content in the backend so the free tier feels generous without becoming noisy and the premium tiers have obvious reasons to exist.
- Turn the sky calendar into a stronger retention loop with live event cards, “look up tonight” prompts, and a clearer free-to-paid bridge.
- Define the institutional story more concretely for planetariums, classrooms, and science centers once the consumer tier polish is finished.
- **Self-host compressed gallery images:** The five STScI gallery images in `index.html` are loaded directly from `stsci-opo.org` at full resolution (some exceed 100MB). Download each, resize to ~1040px wide, and convert to WebP at 85% quality. Host under `/img/` on the server and update `<img src>` in `index.html`. This is the main reason the gallery loads slowly — the CDN latency is compounded by enormous file sizes.
- **Copyright / image usage checklist:** Before expanding the image library, establish a simple process: (1) confirm each image is NASA/ESA/CSA/STScI public domain or CC BY 4.0, (2) record the credit line and original URL in a `docs/image-credits.md` file, (3) ensure the footer credit line stays accurate as new images are added. The current five JWST images are public domain — this process is for future additions.

---

## 10. Copy Reference (canonical strings — do not paraphrase)

**Tagline (footer brand block):**
> A quiet window onto the universe, for the largest screen in your home.

**About copy (index.html only):**
> We built StarSol because the most beautiful images of our universe deserve more than a phone screen and a thumb-scroll. On your television, in a dimmed room, they become what they are: windows. We update the gallery within hours of every public JWST release. We do not show ads. We will never show ads.

**Feature copy:** see §5.3 verbatim.

**Tier names + prices:** Free / Explorer $4.99·$39.99 / Observer $7.99·$64.99 / Institutional $1,500–5,000. Do not change pricing values.

**NASA captions (V1 + V3 photo gallery):**
- PILLARS OF CREATION · M16 EAGLE NEBULA — *6,500 light-years distant. The columns are clouds of hydrogen and dust, lit from within.*
- CARINA NEBULA · COSMIC CLIFFS — *A nursery for stars, 7,600 light-years away. The cliffs are dust, the dust is the future of suns.*
- SOUTHERN RING NEBULA · NGC 3132 — *A dying star, 2,500 light-years off, exhaling itself into the dark.*
- STEPHAN'S QUINTET · HCG 92 — *Four galaxies bound by gravity, one passing through. The first JWST image of cosmic intimacy.*
- COSMIC CLIFFS · NGC 3324 — *A horizon you cannot reach. Eight light-years from the lowest peak to the highest.*

End of specification.
