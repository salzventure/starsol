#!/bin/bash
# One-time server setup for starsol.app on the Lightsail instance.
# Run this ONCE after DNS is pointed at the server.
# Assumes Apache2, certbot, Node, PM2 already installed (from prior apps).

set -e

SSH_KEY="$HOME/.ssh/ls_us_west_2.pem"
SERVER="admin@44.225.86.196"
DOMAIN="starsol.app"
APP_DIR="/opt/starsol-api"
WEB_ROOT="/var/www/html/starsol.app"

echo "[setup] Configuring $DOMAIN on server..."

ssh -i "$SSH_KEY" "$SERVER" << REMOTE
set -e

# Create app and web directories
sudo mkdir -p $APP_DIR $WEB_ROOT
sudo chown admin:admin $APP_DIR
sudo chown www-data:www-data $WEB_ROOT

# Create Apache vhost (HTTP — certbot will add HTTPS)
sudo tee /etc/apache2/sites-available/starsol.app.conf > /dev/null << 'VHOST'
<VirtualHost *:80>
    ServerName starsol.app
    ServerAlias www.starsol.app
    DocumentRoot /var/www/html/starsol.app

    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/.well-known/acme-challenge/
    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
</VirtualHost>
VHOST

sudo a2ensite starsol.app.conf
sudo apache2ctl configtest
sudo systemctl reload apache2

# Get SSL cert
sudo certbot --apache -d starsol.app -d www.starsol.app --non-interactive --agree-tos -m sjsalzberg@gmail.com

# Add API proxy to the SSL vhost that certbot created
sudo tee -a /etc/apache2/sites-enabled/starsol.app-le-ssl.conf > /dev/null << 'PROXY'

    # Proxy Next.js API routes and admin dashboard
    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:3402/api
    ProxyPassReverse /api http://127.0.0.1:3402/api
    ProxyPass /admin http://127.0.0.1:3402/admin
    ProxyPassReverse /admin http://127.0.0.1:3402/admin
PROXY

sudo apache2ctl configtest
sudo systemctl reload apache2

echo "[setup] Done. starsol.app is live with SSL + API proxy on port 3402."
REMOTE

echo "[setup] Complete. Now:"
echo "  1. Add .env to /opt/starsol-api/.env on the server"
echo "  2. Run deploy-step1 through deploy-step3 to deploy the backend"
echo "  3. Run deploy-step4 to deploy the marketing website"
