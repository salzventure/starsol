-- StarSol initial schema
-- Run: supabase db push

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- fuzzy search on content

-- ============================================================
-- PROFILES
-- mirrors Clerk user — created via Clerk webhook on user.created
-- ============================================================
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  clerk_user_id text unique not null,
  email text not null,
  display_name text,
  avatar_url text,
  latitude double precision,        -- for geolocated sky alerts
  longitude double precision,
  timezone text default 'UTC',
  notification_iss boolean default true,
  notification_aurora boolean default true,
  notification_launches boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- SUBSCRIPTIONS
-- source of truth is Stripe — this is a cached read model
-- ============================================================
create type subscription_tier as enum ('free', 'explorer', 'observer', 'institutional');
create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  tier subscription_tier not null default 'free',
  status subscription_status not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  trial_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- one subscription per profile
create unique index subscriptions_profile_id_idx on subscriptions(profile_id);

-- ============================================================
-- PAIRED DEVICES
-- TV devices linked to a profile via QR code
-- ============================================================
create table devices (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  device_name text,                  -- e.g. "Den TV"
  platform text not null,            -- 'google_tv', 'fire_tv', 'apple_tv', 'roku'
  device_fingerprint text not null,  -- hashed device identifier
  pairing_code char(6),              -- short code shown on TV during pairing
  pairing_expires_at timestamptz,    -- codes expire after 10 minutes
  paired_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

create index devices_pairing_code_idx on devices(pairing_code) where pairing_code is not null;
create index devices_profile_id_idx on devices(profile_id);

-- ============================================================
-- CONTENT LIBRARY
-- ============================================================
create type content_type as enum ('video', 'image', 'series', 'episode', 'live_event');
create type content_tier as enum ('free', 'explorer', 'observer');

create table content (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  type content_type not null,
  tier content_tier not null default 'free',
  title text not null,
  description text,
  short_description text,           -- ≤120 chars, shown on TV cards
  thumbnail_url text,
  backdrop_url text,                -- full-bleed hero image
  duration_seconds integer,         -- for videos/episodes
  mux_asset_id text,                -- Mux video asset
  mux_playback_id text,             -- public playback ID
  series_id uuid references content(id), -- null if standalone
  episode_number integer,
  season_number integer default 1,
  tags text[] default '{}',         -- ['jwst', 'black-holes', 'iss', ...]
  credit_line text,                 -- "NASA, ESA, CSA, STScI"
  published_at timestamptz,
  is_published boolean default false,
  view_count integer default 0,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index content_slug_idx on content(slug);
create index content_type_idx on content(type);
create index content_tier_idx on content(tier);
create index content_published_idx on content(published_at desc) where is_published = true;
create index content_series_idx on content(series_id) where series_id is not null;
create index content_tags_idx on content using gin(tags);
create index content_title_search_idx on content using gin(title gin_trgm_ops);

-- ============================================================
-- AMBIENT IMAGES
-- JWST / ESO / NOIRLab imagery for ambient mode
-- ============================================================
create table ambient_images (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  description text,
  image_url text not null,           -- full-res (8K when available)
  thumbnail_url text,
  credit_line text not null,         -- "NASA, ESA, CSA, STScI"
  source text not null,              -- 'jwst', 'hubble', 'eso', 'noirlab', 'nasa'
  tier content_tier not null default 'free',
  object_name text,                  -- e.g. "Pillars of Creation"
  object_type text,                  -- e.g. "nebula", "galaxy", "star cluster"
  tags text[] default '{}',
  is_featured boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index ambient_source_idx on ambient_images(source);
create index ambient_tier_idx on ambient_images(tier);
create index ambient_featured_idx on ambient_images(is_featured) where is_featured = true;

-- ============================================================
-- SKY EVENTS
-- populated by JPL Horizons + USNO API (cron job)
-- ============================================================
create type sky_event_type as enum (
  'meteor_shower', 'eclipse_solar', 'eclipse_lunar',
  'conjunction', 'opposition', 'planet_visibility',
  'iss_pass', 'aurora', 'launch', 'comet', 'occultation'
);

create table sky_events (
  id uuid primary key default uuid_generate_v4(),
  type sky_event_type not null,
  title text not null,
  description text,
  short_description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  peak_at timestamptz,               -- best viewing time
  is_geolocated boolean default false, -- requires user location?
  visibility_notes text,             -- "Best from northern hemisphere"
  magnitude double precision,        -- astronomical magnitude where applicable
  constellation text,
  thumbnail_url text,
  tier content_tier not null default 'free', -- iss_pass/aurora = observer
  source text,                       -- 'jpl', 'usno', 'manual'
  external_id text,                  -- ID from source API
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index sky_events_starts_at_idx on sky_events(starts_at asc);
create index sky_events_type_idx on sky_events(type);
create index sky_events_tier_idx on sky_events(tier);

-- ============================================================
-- USER WATCH HISTORY
-- ============================================================
create table watch_history (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  content_id uuid not null references content(id) on delete cascade,
  watched_seconds integer default 0,
  completed boolean default false,
  last_watched_at timestamptz default now(),
  unique(profile_id, content_id)
);

create index watch_history_profile_idx on watch_history(profile_id);
create index watch_history_last_watched_idx on watch_history(last_watched_at desc);

-- ============================================================
-- USER FAVORITES / WATCHLIST
-- ============================================================
create table favorites (
  profile_id uuid not null references profiles(id) on delete cascade,
  content_id uuid not null references content(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (profile_id, content_id)
);

-- ============================================================
-- HOME ROWS CONFIGURATION (admin-controlled)
-- defines what appears on the TV home dashboard
-- ============================================================
create table home_rows (
  id uuid primary key default uuid_generate_v4(),
  title text not null,              -- "Tonight's Sky", "JWST Gallery", etc.
  subtitle text,
  row_type text not null,           -- 'content', 'sky_events', 'ambient', 'featured'
  content_query jsonb,              -- {type: 'video', tags: ['jwst'], limit: 10}
  sort_order integer not null default 0,
  is_active boolean default true,
  min_tier content_tier default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- EMAIL CAMPAIGNS (simple log — Resend handles delivery)
-- ============================================================
create type email_campaign_status as enum ('draft', 'scheduled', 'sent', 'canceled');

create table email_campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subject text not null,
  preview_text text,
  html_body text not null,
  target_tiers subscription_tier[] default '{}', -- empty = all tiers
  status email_campaign_status default 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table devices enable row level security;
alter table watch_history enable row level security;
alter table favorites enable row level security;

-- profiles: users can only read/write their own
create policy "profiles: own read" on profiles for select using (
  clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
);
create policy "profiles: own update" on profiles for update using (
  clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
);

-- subscriptions: read own only
create policy "subscriptions: own read" on subscriptions for select using (
  profile_id = (
    select id from profiles
    where clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- devices: read own only
create policy "devices: own read" on devices for select using (
  profile_id = (
    select id from profiles
    where clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- content: public read for published free content, tier check for premium
create policy "content: free read" on content for select using (
  is_published = true and tier = 'free'
);
-- premium content access checked in API layer (not RLS) to avoid complexity

-- ambient_images: public read
create policy "ambient: public read" on ambient_images for select using (true);

-- sky_events: public read
create policy "sky_events: public read" on sky_events for select using (true);

-- watch_history: own only
create policy "watch_history: own read" on watch_history for select using (
  profile_id = (
    select id from profiles
    where clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);
create policy "watch_history: own write" on watch_history for all using (
  profile_id = (
    select id from profiles
    where clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- favorites: own only
create policy "favorites: own all" on favorites for all using (
  profile_id = (
    select id from profiles
    where clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- ============================================================
-- SEED: DEFAULT HOME ROWS
-- ============================================================
insert into home_rows (title, subtitle, row_type, content_query, sort_order) values
  ('Featured', null, 'featured', '{"limit": 1}', 0),
  ('Tonight''s Sky', 'Events visible right now', 'sky_events', '{"limit": 8, "upcoming_hours": 24}', 1),
  ('JWST Gallery', 'Latest from the Webb telescope', 'content', '{"tags": ["jwst"], "type": "image", "limit": 12}', 2),
  ('Series', 'Deep dives into the cosmos', 'content', '{"type": "series", "limit": 10}', 3),
  ('Documentaries', null, 'content', '{"type": "video", "limit": 12}', 4),
  ('Ambient Mode', 'Living art for your TV', 'ambient', '{"limit": 20}', 5),
  ('Live Events', 'Launches · Eclipses · JWST drops', 'content', '{"type": "live_event", "limit": 8}', 6);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();
create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function update_updated_at();
create trigger content_updated_at before update on content
  for each row execute function update_updated_at();
create trigger sky_events_updated_at before update on sky_events
  for each row execute function update_updated_at();
create trigger home_rows_updated_at before update on home_rows
  for each row execute function update_updated_at();
