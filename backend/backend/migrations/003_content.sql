-- 003: Content library, ambient images, watch history, favorites

CREATE TABLE IF NOT EXISTS content (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  content_type ENUM('video','image','series','episode','live_event') NOT NULL,
  tier ENUM('free','explorer','observer') NOT NULL DEFAULT 'free',
  title VARCHAR(500) NOT NULL,
  description TEXT,
  short_description VARCHAR(200),
  thumbnail_url TEXT,
  backdrop_url TEXT,
  duration_seconds INT,
  mux_asset_id VARCHAR(255),
  mux_playback_id VARCHAR(255),
  series_id INT,
  episode_number INT,
  season_number INT DEFAULT 1,
  tags JSON,
  credit_line VARCHAR(500),
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  published_at BIGINT,
  sort_order INT DEFAULT 0,
  view_count INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_slug (slug),
  INDEX idx_type (content_type),
  INDEX idx_tier (tier),
  INDEX idx_published (published_at),
  INDEX idx_series (series_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ambient_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  credit_line VARCHAR(500) NOT NULL,
  source ENUM('jwst','hubble','eso','noirlab','nasa') NOT NULL,
  tier ENUM('free','explorer','observer') NOT NULL DEFAULT 'free',
  object_name VARCHAR(255),
  tags JSON,
  is_featured TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  INDEX idx_source (source),
  INDEX idx_featured (is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS watch_history (
  user_id INT NOT NULL,
  content_id INT NOT NULL,
  watched_seconds INT DEFAULT 0,
  completed TINYINT(1) DEFAULT 0,
  last_watched_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, content_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
  INDEX idx_user_last (user_id, last_watched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favorites (
  user_id INT NOT NULL,
  content_id INT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, content_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
