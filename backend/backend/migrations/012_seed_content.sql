-- 012: Seed astronomy content — public domain NASA/ESA/STScI imagery
-- INSERT IGNORE so re-running is safe.
-- All timestamps: milliseconds (Date.now() equivalent = 1704067200000 = 2024-01-01).

-- ── Content library ──────────────────────────────────────────────────────────

INSERT IGNORE INTO content
  (slug, content_type, tier, title, description, short_description,
   thumbnail_url, backdrop_url, tags, credit_line,
   is_published, published_at, sort_order, created_at, updated_at)
VALUES
(
  'jwst-deep-field-smacs-0723', 'image', 'explorer',
  'Webb''s First Deep Field',
  'Webb''s first full-color science image — SMACS 0723 — reveals thousands of galaxies, including the faintest objects ever observed in infrared. Light bent by gravitational lensing reveals galaxies from over 13 billion years ago.',
  'The deepest infrared view of the universe ever taken.',
  'https://esawebb.org/media/archives/images/screen/weic2209a.jpg',
  'https://esawebb.org/media/archives/images/large/weic2209a.jpg',
  '["deep field","galaxies","gravitational lensing","smacs","nircam"]',
  'NASA, ESA, CSA, STScI',
  1, 1704067200000, 10, 1704067200000, 1704067200000
),
(
  'pillars-of-creation-miri', 'image', 'explorer',
  'Pillars of Creation — MIRI View',
  'Webb''s Mid-Infrared Instrument reveals the Pillars of Creation in eerie, ghostly blue — dust and gas columns where new stars are forming inside the Eagle Nebula (M16), 6,500 light-years away.',
  'Star-forming columns in the Eagle Nebula, seen in mid-infrared.',
  'https://esawebb.org/media/archives/images/screen/weic2218a.jpg',
  'https://esawebb.org/media/archives/images/large/weic2218a.jpg',
  '["pillars of creation","eagle nebula","miri","star formation","m16"]',
  'NASA, ESA, CSA, STScI',
  1, 1704067200000, 20, 1704067200000, 1704067200000
),
(
  'carina-nebula-jwst', 'image', 'explorer',
  'Cosmic Cliffs — Carina Nebula',
  'Webb reveals the stellar nursery at the edge of a gigantic gaseous cavity in the Carina Nebula. Hundreds of previously hidden stars are now visible in this mountain-and-valley landscape.',
  'A stellar nursery at the edge of a gigantic gaseous cavity.',
  'https://esawebb.org/media/archives/images/screen/weic2207a.jpg',
  'https://esawebb.org/media/archives/images/large/weic2207a.jpg',
  '["carina nebula","star formation","nircam","cosmic cliffs","eta carinae"]',
  'NASA, ESA, CSA, STScI',
  1, 1704067200000, 30, 1704067200000, 1704067200000
),
(
  'stephans-quintet-jwst', 'image', 'explorer',
  'Stephan''s Quintet',
  'Webb''s largest image to date shows five galaxies — four locked in a cosmic dance of tidal forces. Shock waves as one galaxy plows through the group are clearly visible in this mosaic of nearly 1,000 image files.',
  'Five galaxies in a cosmic dance of gravitational forces.',
  'https://esawebb.org/media/archives/images/screen/weic2208a.jpg',
  'https://esawebb.org/media/archives/images/large/weic2208a.jpg',
  '["stephan quintet","galaxies","galaxy cluster","nircam","miri"]',
  'NASA, ESA, CSA, STScI',
  1, 1704067200000, 40, 1704067200000, 1704067200000
),
(
  'southern-ring-nebula-jwst', 'image', 'explorer',
  'Southern Ring Nebula',
  'Webb reveals two stars at the center of the Southern Ring Nebula — a dying star expelling shells of gas and dust. The faint star at center is surrounded by dust it has been ejecting for thousands of years.',
  'A dying star''s final exhalation, 2,500 light-years away.',
  'https://esawebb.org/media/archives/images/screen/weic2205a.jpg',
  'https://esawebb.org/media/archives/images/large/weic2205a.jpg',
  '["southern ring nebula","planetary nebula","dying star","nircam","miri"]',
  'NASA, ESA, CSA, STScI',
  1, 1704067200000, 50, 1704067200000, 1704067200000
),
(
  'tarantula-nebula-jwst', 'image', 'observer',
  'Tarantula Nebula',
  'Webb peers into the Tarantula Nebula — the largest and brightest star-forming region in our galactic neighborhood — revealing tens of thousands of young stars never seen before, 161,000 light-years away.',
  'The most active stellar nursery in the Local Group.',
  'https://esawebb.org/media/archives/images/screen/weic2211a.jpg',
  'https://esawebb.org/media/archives/images/large/weic2211a.jpg',
  '["tarantula nebula","30 doradus","large magellanic cloud","star formation","nircam"]',
  'NASA, ESA, CSA, STScI',
  1, 1704067200000, 60, 1704067200000, 1704067200000
),
(
  'cartwheel-galaxy-jwst', 'image', 'observer',
  'Cartwheel Galaxy',
  'Webb''s sharp infrared eyes reveal the Cartwheel Galaxy in stunning detail — a galaxy reshaped by a high-speed collision. The bright core and surrounding ring of young blue star clusters tell the story of an ancient cosmic crash.',
  'A collision-reshaped galaxy 500 million light-years away.',
  'https://esawebb.org/media/archives/images/screen/weic2209b.jpg',
  'https://esawebb.org/media/archives/images/large/weic2209b.jpg',
  '["cartwheel galaxy","ring galaxy","collision","nircam","miri","sculptor"]',
  'NASA, ESA, CSA, STScI',
  1, 1704067200000, 70, 1704067200000, 1704067200000
),
(
  'getting-started-starsol', 'video', 'free',
  'Welcome to StarSol',
  'A short introduction to StarSol — your window to the universe on the largest screen in your home. Learn how to navigate the app, set up ambient mode, and explore the sky calendar.',
  'Your guide to the StarSol experience.',
  'https://esawebb.org/media/archives/images/screen/weic2209a.jpg',
  'https://esawebb.org/media/archives/images/large/weic2209a.jpg',
  '["intro","welcome","tutorial","ambient","navigation"]',
  'StarSol',
  1, 1704067200000, 1, 1704067200000, 1704067200000
);

-- ── Ambient images ───────────────────────────────────────────────────────────

INSERT IGNORE INTO ambient_images
  (slug, title, description, image_url, thumbnail_url, credit_line,
   source, tier, object_name, tags, is_featured, sort_order, created_at)
VALUES
(
  'ambient-deep-field', 'Webb''s First Deep Field',
  'Thousands of galaxies in the deepest infrared view of the universe.',
  'https://esawebb.org/media/archives/images/large/weic2209a.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2209a.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'free',
  'SMACS 0723', '["deep field","galaxies","gravitational lensing"]',
  1, 10, 1704067200000
),
(
  'ambient-pillars-miri', 'Pillars of Creation — MIRI',
  'The Eagle Nebula''s star-forming columns in mid-infrared.',
  'https://esawebb.org/media/archives/images/large/weic2218a.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2218a.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'explorer',
  'Eagle Nebula M16', '["pillars","star formation","miri"]',
  1, 20, 1704067200000
),
(
  'ambient-carina-cliffs', 'Cosmic Cliffs — Carina Nebula',
  'A mountain-and-valley stellar nursery at the edge of a gaseous cavity.',
  'https://esawebb.org/media/archives/images/large/weic2207a.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2207a.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'explorer',
  'Carina Nebula', '["nebula","star formation","cosmic cliffs"]',
  1, 30, 1704067200000
),
(
  'ambient-stephans-quintet', 'Stephan''s Quintet',
  'Four galaxies locked in a gravitational dance, with a fifth interloper.',
  'https://esawebb.org/media/archives/images/large/weic2208a.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2208a.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'explorer',
  'Stephan''s Quintet', '["galaxies","galaxy group","tidal forces"]',
  0, 40, 1704067200000
),
(
  'ambient-southern-ring', 'Southern Ring Nebula',
  'A dying star''s expanding shells of gas and dust.',
  'https://esawebb.org/media/archives/images/large/weic2205a.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2205a.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'explorer',
  'Southern Ring Nebula', '["planetary nebula","dying star"]',
  0, 50, 1704067200000
),
(
  'ambient-tarantula', 'Tarantula Nebula',
  'The most active stellar nursery in our galactic neighborhood.',
  'https://esawebb.org/media/archives/images/large/weic2211a.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2211a.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'observer',
  'Tarantula Nebula 30 Doradus', '["nebula","star formation","lmc"]',
  1, 60, 1704067200000
),
(
  'ambient-cartwheel', 'Cartwheel Galaxy',
  'A collision-reshaped ring galaxy 500 million light-years away.',
  'https://esawebb.org/media/archives/images/large/weic2209b.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2209b.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'observer',
  'Cartwheel Galaxy', '["galaxy","ring galaxy","collision"]',
  0, 70, 1704067200000
),
(
  'ambient-jupiter-jwst', 'Jupiter — Webb''s View',
  'Jupiter''s auroras, rings, and two small moons in infrared detail.',
  'https://esawebb.org/media/archives/images/large/weic2201a.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2201a.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'explorer',
  'Jupiter', '["jupiter","planet","aurora","rings","nircam"]',
  0, 80, 1704067200000
),
(
  'ambient-phantom-galaxy', 'Phantom Galaxy M74',
  'Webb reveals the spiral structure of M74 in unprecedented clarity.',
  'https://esawebb.org/media/archives/images/large/weic2215b.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2215b.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'explorer',
  'Phantom Galaxy M74', '["spiral galaxy","m74","miri","nircam"]',
  0, 90, 1704067200000
),
(
  'ambient-neptune-rings', 'Neptune and Its Rings',
  'Webb captures Neptune''s rings — the clearest view in 33 years.',
  'https://esawebb.org/media/archives/images/large/weic2216a.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2216a.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'explorer',
  'Neptune', '["neptune","planet","rings","nircam"]',
  0, 100, 1704067200000
),
(
  'ambient-rho-ophiuchi', 'Rho Ophiuchi Cloud Complex',
  'The closest star-forming region to Earth — newborn stars emerging from their dusty cocoons.',
  'https://esawebb.org/media/archives/images/large/weic2313a.jpg',
  'https://esawebb.org/media/archives/images/screen/weic2313a.jpg',
  'NASA, ESA, CSA, STScI', 'jwst', 'observer',
  'Rho Ophiuchi', '["star formation","cloud complex","nircam","newborn stars"]',
  1, 110, 1704067200000
);
