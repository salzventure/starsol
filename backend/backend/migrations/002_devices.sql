-- 002: TV device pairing

CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  platform ENUM('google_tv','fire_tv','apple_tv','roku') NOT NULL,
  device_fingerprint VARCHAR(255) NOT NULL UNIQUE,
  device_name VARCHAR(255),
  pairing_code CHAR(6),
  pairing_expires_at BIGINT,
  paired_at BIGINT,
  last_seen_at BIGINT,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_pairing_code (pairing_code),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
