#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---check}"

if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  echo "Usage: $0 [--check|--apply]" >&2
  exit 2
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This script is intended for the Debian/Ubuntu production host." >&2
  exit 1
fi

run() {
  if [[ "$MODE" == "--apply" ]]; then
    "$@"
  else
    printf '[check] %q ' "$@"
    printf '\n'
  fi
}

write_root_file() {
  local path="$1"
  if [[ "$MODE" == "--apply" ]]; then
    sudo install -d -m 0755 "$(dirname "$path")"
    sudo tee "$path" >/dev/null
  else
    echo "[check] would write $path"
    cat >/dev/null
  fi
}

echo "Mode: $MODE"
echo "Host: $(hostname)"

if ! command -v fail2ban-client >/dev/null 2>&1; then
  run sudo apt-get update
  run sudo apt-get install -y fail2ban
fi

run sudo a2enmod remoteip
write_root_file /etc/apache2/conf-available/cloudflare-remoteip.conf <<'EOF'
RemoteIPHeader CF-Connecting-IP
RemoteIPTrustedProxy 173.245.48.0/20
RemoteIPTrustedProxy 103.21.244.0/22
RemoteIPTrustedProxy 103.22.200.0/22
RemoteIPTrustedProxy 103.31.4.0/22
RemoteIPTrustedProxy 141.101.64.0/18
RemoteIPTrustedProxy 108.162.192.0/18
RemoteIPTrustedProxy 190.93.240.0/20
RemoteIPTrustedProxy 188.114.96.0/20
RemoteIPTrustedProxy 197.234.240.0/22
RemoteIPTrustedProxy 198.41.128.0/17
RemoteIPTrustedProxy 162.158.0.0/15
RemoteIPTrustedProxy 104.16.0.0/13
RemoteIPTrustedProxy 104.24.0.0/14
RemoteIPTrustedProxy 172.64.0.0/13
RemoteIPTrustedProxy 131.0.72.0/22
RemoteIPTrustedProxy 2400:cb00::/32
RemoteIPTrustedProxy 2606:4700::/32
RemoteIPTrustedProxy 2803:f800::/32
RemoteIPTrustedProxy 2405:b500::/32
RemoteIPTrustedProxy 2405:8100::/32
RemoteIPTrustedProxy 2a06:98c0::/29
RemoteIPTrustedProxy 2c0f:f248::/32
EOF
run sudo a2enconf cloudflare-remoteip
run sudo apache2ctl configtest
run sudo systemctl reload apache2

write_root_file /etc/fail2ban/filter.d/salzventure-web-probes.conf <<'EOF'
[Definition]
failregex = ^(?:\S+:\d+\s+)?<HOST>\s+\S+\s+\S+\s+\[[^\]]+\]\s+"(?:GET|POST|HEAD|OPTIONS)\s+/(?:\.env[\w.-]*|\.git(?:/|$)|wp-admin(?:/|$)|wp-login\.php|(?:wp/)?xmlrpc\.php|phpmyadmin(?:/|$)|pma(?:/|$)|vendor/phpunit|boaform|cgi-bin(?:/|$)|actuator(?:/|$)|HNAP1|setup\.cgi|login\.cgi)[^"]*\s+HTTP/[0-9.]+"\s+(?:301|400|401|403|404|405|429)\b
ignoreregex =
EOF

write_root_file /etc/fail2ban/filter.d/salzventure-app-auth.conf <<'EOF'
[Definition]
failregex = ^(?:\S+:\d+\s+)?<HOST>\s+\S+\s+\S+\s+\[[^\]]+\]\s+"(?:GET|POST|PUT|PATCH|DELETE)\s+/(?:api/)?(?:auth|admin|oauth|siwa|storekit|play-billing|billing|tv-link|portfolio-pin|account|login|reset-password|forgot-password)[^"]*\s+HTTP/[0-9.]+"\s+(?:401|403|429)\b
ignoreregex =
EOF

write_root_file /etc/fail2ban/jail.d/salzventure-apps.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
backend = systemd
maxretry = 5

[salzventure-web-probes]
enabled = true
filter = salzventure-web-probes
port = http,https
logpath = /var/log/apache2/*access*.log
maxretry = 3
findtime = 10m
bantime = 4h

[salzventure-app-auth]
enabled = true
filter = salzventure-app-auth
port = http,https
logpath = /var/log/apache2/*access*.log
maxretry = 8
findtime = 10m
bantime = 1h
EOF

if [[ "$MODE" == "--apply" ]]; then
  sample="$(mktemp)"
  cat >"$sample" <<'EOF'
198.51.100.10 - - [03/Jun/2026:17:58:13 +0000] "GET /.env HTTP/1.1" 404 2081 "-" "scanner"
203.0.113.20 - - [03/Jun/2026:18:00:00 +0000] "POST /api/auth/login HTTP/1.1" 401 64 "-" "curl"
EOF
  sudo fail2ban-regex "$sample" /etc/fail2ban/filter.d/salzventure-web-probes.conf >/dev/null
  sudo fail2ban-regex "$sample" /etc/fail2ban/filter.d/salzventure-app-auth.conf >/dev/null
  rm -f "$sample"
  sudo fail2ban-client -t
fi

run sudo systemctl enable --now fail2ban
run sudo systemctl restart fail2ban

if [[ "$MODE" == "--apply" ]]; then
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sudo fail2ban-client ping >/dev/null 2>&1 && break
    sleep 1
  done
  sudo fail2ban-client status
  sudo fail2ban-client status salzventure-web-probes || true
  sudo fail2ban-client status salzventure-app-auth || true
fi
