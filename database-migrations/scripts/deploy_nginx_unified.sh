#!/usr/bin/env bash
# =====================================================================
#  Deploie la config nginx UNIFIEE (frontend + API same-origin).
#  A executer SUR LE SERVEUR (87.106.246.77). Les deux fichiers source
#  doivent etre presents dans /tmp:
#    /tmp/ba9alino-api.conf      -> snippet locations API
#    /tmp/ba9alino.conf.final    -> server-blocks
# =====================================================================
set -euo pipefail

SNIPPET_SRC=/tmp/ba9alino-api.conf
CONF_SRC=/tmp/ba9alino.conf.final
SNIPPET_DST=/etc/nginx/snippets/ba9alino-api.conf
CONF_DST=/etc/nginx/conf.d/ba9alino.conf

echo "==> Normalisation CRLF -> LF"
sed -i 's/\r$//' "$SNIPPET_SRC" "$CONF_SRC"

echo "==> Verification des certificats requis"
for d in ba9alino.ma ba9alino.duckdns.org; do
  if [ ! -f "/etc/letsencrypt/live/$d/fullchain.pem" ]; then
    echo "!! Certificat manquant pour $d (/etc/letsencrypt/live/$d/)" >&2
    echo "   Genere-le avec: certbot --nginx -d $d" >&2
    exit 1
  fi
done

echo "==> Installation du snippet API"
mkdir -p /etc/nginx/snippets
cp "$SNIPPET_SRC" "$SNIPPET_DST"

echo "==> Sauvegarde de la config active"
if [ -f "$CONF_DST" ]; then
  cp "$CONF_DST" "${CONF_DST}.bak.$(date +%Y%m%d-%H%M%S)"
fi

echo "==> Installation de la nouvelle config"
cp "$CONF_SRC" "$CONF_DST"

# Desactive d'eventuelles configs concurrentes dans sites-enabled qui
# captureraient les memes server_name (source classique de 405/conflits).
if [ -d /etc/nginx/sites-enabled ]; then
  for f in /etc/nginx/sites-enabled/*; do
    [ -e "$f" ] || continue
    if grep -lqE 'ba9alino\.(ma|duckdns\.org)' "$f" 2>/dev/null; then
      echo "==> Desactivation config concurrente: $f"
      mv "$f" "${f}.disabled.$(date +%Y%m%d-%H%M%S)"
    fi
  done
fi

echo "==> Test de la config nginx"
nginx -t

echo "==> Rechargement nginx"
systemctl reload nginx

echo "==> Verifications HTTP (preflight OPTIONS + POST)"
echo "--- OPTIONS /rest/v1/rpc/superadmin_login (attendu 204) ---"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X OPTIONS \
  -H "Origin: https://ba9alino.ma" \
  -H "Access-Control-Request-Method: POST" \
  https://ba9alino.ma/rest/v1/rpc/superadmin_login || true

echo "--- POST /auth/v1/token (attendu 400/401, PAS 405) ---"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST \
  -H "Content-Type: application/json" -H "apikey: test" \
  -d '{}' \
  "https://ba9alino.ma/auth/v1/token?grant_type=password" || true

echo "DEPLOY_UNIFIED_OK"
