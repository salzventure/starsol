-- Run this as the Lightsail DB master user ONCE to provision StarSol.
-- Replace 'CHOOSE_A_STRONG_PASSWORD' with the password you'll put in .env

CREATE DATABASE IF NOT EXISTS starsol_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'app_starsol_usr'@'%'
  IDENTIFIED BY 'CHOOSE_A_STRONG_PASSWORD';

GRANT ALL PRIVILEGES ON starsol_app.* TO 'app_starsol_usr'@'%';

FLUSH PRIVILEGES;

-- Verify
SELECT User, Host FROM mysql.user WHERE User = 'app_starsol_usr';
SHOW DATABASES LIKE 'starsol_app';
