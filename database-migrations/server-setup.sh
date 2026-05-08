#!/bin/bash
set -e

echo "=== 1. Configuration PostgreSQL ==="
sudo -u postgres psql <<'PSQL'
CREATE DATABASE ba9alino;
CREATE USER ba9alino_admin WITH PASSWORD 'Ba9alinoAdmin2024!';
GRANT ALL PRIVILEGES ON DATABASE ba9alino TO ba9alino_admin;
\c ba9alino
GRANT ALL ON SCHEMA public TO ba9alino_admin;
CREATE USER ba9alino_anon NOLOGIN;
GRANT USAGE ON SCHEMA public TO ba9alino_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ba9alino_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ba9alino_anon;
CREATE USER authenticator WITH PASSWORD 'AuthPass2024!' NOINHERIT;
GRANT ba9alino_anon TO authenticator;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
PSQL

echo "=== 2. Téléchargement PostgREST ==="
cd /tmp
wget -q https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
tar xf postgrest-v12.2.3-linux-static-x64.tar.xz
mv postgrest /usr/local/bin/
chmod +x /usr/local/bin/postgrest
postgrest --version

echo "=== 3. Génération du secret JWT ==="
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"

echo "=== 4. Configuration PostgREST ==="
mkdir -p /etc/postgrest
cat > /etc/postgrest/ba9alino.conf <<EOF
db-uri = "postgres://authenticator:AuthPass2024!@localhost:5432/ba9alino"
db-schema = "public"
db-anon-role = "ba9alino_anon"
jwt-secret = "$JWT_SECRET"
server-port = 3001
server-host = "127.0.0.1"
log-level = "info"
EOF

echo "JWT_SECRET for .env: $JWT_SECRET" > /root/ba9alino-secrets.txt

echo "=== 5. Service systemd PostgREST ==="
cat > /etc/systemd/system/postgrest.service <<EOF
[Unit]
Description=PostgREST API Server for Ba9alino
After=postgresql.service
Requires=postgresql.service

[Service]
ExecStart=/usr/local/bin/postgrest /etc/postgrest/ba9alino.conf
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable postgrest
systemctl start postgrest
sleep 2
systemctl status postgrest --no-pager

echo "=== 6. Nginx config pour PostgREST API ==="
cat > /etc/nginx/sites-available/api.ba9alino <<'NGINX'
server {
    listen 80;
    server_name api.ba9alino.duckdns.org;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Prefer, Range" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
NGINX

ln -sf /etc/nginx/sites-available/api.ba9alino /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "=== DONE ==="
echo "PostgREST tourne sur http://127.0.0.1:3001"
echo "API publique via Nginx sur http://87.106.246.77/api"
cat /root/ba9alino-secrets.txt
