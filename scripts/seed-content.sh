#!/bin/bash
# Run once on the server to seed astronomy content.
SSH_KEY="$HOME/.ssh/ls_us_west_2.pem"
SERVER="admin@44.225.86.196"
echo "Seeding content..."
scp -i "$SSH_KEY" backend/backend/migrations/012_seed_content.sql "$SERVER:/tmp/"
ssh -i "$SSH_KEY" "$SERVER" "mysql -u\$DB_USER -p\$DB_PASS \$DB_NAME < /tmp/012_seed_content.sql && echo 'Seed complete'"
