-- 007: Google Play IAP subscriptions

CREATE TABLE IF NOT EXISTS play_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  package_name VARCHAR(255),
  subscription_id VARCHAR(255),
  purchase_token_hash CHAR(64) NOT NULL UNIQUE,
  purchase_token_last4 VARCHAR(16),
  plan ENUM('explorer','observer') NOT NULL,
  status VARCHAR(50) NOT NULL,
  expiry_ms BIGINT,
  auto_renewing TINYINT(1),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_user (user_id),
  INDEX idx_subscription (subscription_id),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
