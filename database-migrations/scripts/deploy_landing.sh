#!/usr/bin/env bash
# =====================================================================
#  Deploie la landing page commerciale.
#  A executer SUR LE SERVEUR (87.106.246.77). Le fichier source doit
#  etre present dans /tmp/landing-index.html.
# =====================================================================
set -euo pipefail

SRC=/tmp/landing-index.html
DEST_DIR=/var/www/ba9alino-landing

if [ ! -f "$SRC" ]; then
  echo "!! Fichier $SRC introuvable" >&2; exit 1
fi

echo "==> Normalisation CRLF -> LF"
sed -i 's/\r$//' "$SRC"

echo "==> Creation du repertoire de destination"
mkdir -p "$DEST_DIR"

echo "==> Installation de la landing"
cp "$SRC" "$DEST_DIR/index.html"
chown -R www-data:www-data "$DEST_DIR" 2>/dev/null || true
chmod 644 "$DEST_DIR/index.html"

echo "==> Test config nginx"
nginx -t

echo "==> Rechargement nginx"
systemctl reload nginx

echo "==> Verification HTTP"
echo "--- GET / (attendu: HTML landing, contient 'Ba9alino') ---"
curl -sk https://ba9alino.ma/ | grep -oE 'Ba9alino[^<]{0,40}' | head -3 || true

echo "--- GET /login (attendu: SPA React, contient 'root' div) ---"
curl -sk https://ba9alino.ma/login | grep -oE '<div id="root"[^>]*>' | head -1 || true

echo "DEPLOY_LANDING_OK"
