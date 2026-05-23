-- 004: Sky events calendar

CREATE TABLE IF NOT EXISTS sky_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type ENUM('meteor_shower','eclipse_solar','eclipse_lunar','conjunction','opposition',
                  'planet_visibility','iss_pass','aurora','launch','comet','occultation') NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  short_description VARCHAR(200),
  starts_at BIGINT NOT NULL,
  ends_at BIGINT,
  peak_at BIGINT,
  is_geolocated TINYINT(1) DEFAULT 0,
  visibility_notes TEXT,
  tier ENUM('free','explorer','observer') NOT NULL DEFAULT 'free',
  source VARCHAR(50) DEFAULT 'manual',
  thumbnail_url TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_starts_at (starts_at),
  INDEX idx_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
