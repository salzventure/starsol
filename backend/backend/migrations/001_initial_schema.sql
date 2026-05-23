-- 001: Users, subscriptions, events
-- All timestamps: BIGINT milliseconds (Date.now()). Never seconds.

CREATE TABLE IF NOT EXISTS _migrations (
  name VARCHAR(255) PRIMARY KEY,
  applied_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  role ENUM('free','explorer','observer','institutional','admin','superadmin') DEFAULT 'free',
  plan ENUM('free','explorer','observer','institutional') DEFAULT 'free',
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  stripe_customer_id VARCHAR(255),
  latitude DOUBLE,
  longitude DOUBLE,
  timezone VARCHAR(100) DEFAULT 'UTC',
  notify_iss TINYINT(1) DEFAULT 1,
  notify_aurora TINYINT(1) DEFAULT 1,
  notify_launches TINYINT(1) DEFAULT 1,
  session_version INT NOT NULL DEFAULT 1,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until BIGINT,
  created_at BIGINT NOT NULL,
  last_login_at BIGINT,
  INDEX idx_email (email),
  INDEX idx_plan (plan),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_price_id VARCHAR(255),
  plan ENUM('free','explorer','observer','institutional') NOT NULL DEFAULT 'free',
  status ENUM('active','trialing','past_due','canceled','incomplete') NOT NULL DEFAULT 'active',
  current_period_start BIGINT,
  current_period_end BIGINT,
  cancel_at_period_end TINYINT(1) DEFAULT 0,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_stripe_customer (stripe_customer_id),
  INDEX idx_stripe_sub (stripe_subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used_at BIGINT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  type VARCHAR(100),
  event VARCHAR(100),
  data JSON,
  source VARCHAR(100),
  ip_address VARCHAR(64),
  ts BIGINT NOT NULL,
  INDEX idx_user_ts (user_id, ts),
  INDEX idx_event (event)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
