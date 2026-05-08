#!/bin/bash
set -e

echo "=== Installation Node.js ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version && npm --version

echo "=== Déploiement du service Auth ==="
mkdir -p /opt/ba9alino/auth
cp -r /tmp/auth-service/* /opt/ba9alino/auth/
cd /opt/ba9alino/auth
npm install --production

JWT_SECRET=$(grep "jwt-secret" /etc/postgrest/ba9alino.conf | cut -d'"' -f2)

cat > /etc/systemd/system/ba9alino-auth.service <<EOF
[Unit]
Description=Ba9alino Auth Service
After=postgresql.service postgrest.service
Requires=postgresql.service

[Service]
WorkingDirectory=/opt/ba9alino/auth
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3002
Environment=JWT_SECRET=$JWT_SECRET
User=www-data

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ba9alino-auth
systemctl start ba9alino-auth
sleep 2
systemctl status ba9alino-auth --no-pager

echo "=== Config Nginx finale ==="
cat > /etc/nginx/sites-available/ba9alino-api <<'NGINX'
server {
    listen 80;
    server_name ba9alino.duckdns.org;

    # Frontend (déjà existant dans /var/www/html ou similaire)
    root /var/www/ba9alino;
    index index.html;

    # REST API → PostgREST
    location /rest/v1/ {
        rewrite ^/rest/v1/(.*) /$1 break;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Prefer, Range, apikey" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
        if ($request_method = OPTIONS) { return 204; }
    }

    # Auth → Auth service
    location /auth/v1/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, apikey" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        if ($request_method = OPTIONS) { return 204; }
    }

    # Storage (fichiers statiques uploadés)
    location /storage/v1/object/public/ {
        alias /opt/ba9alino/storage/;
        try_files $uri $uri/ =404;
        add_header Access-Control-Allow-Origin "*" always;
    }

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ba9alino-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "=== Test des services ==="
sleep 1
curl -s http://127.0.0.1:3001/ | head -c 200
echo ""
curl -s http://127.0.0.1:3002/health
echo ""
echo "=== DONE ==="
