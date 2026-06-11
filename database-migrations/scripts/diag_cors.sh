#!/bin/bash
echo "=== sites-enabled ==="
ls -l /etc/nginx/sites-enabled/

echo
echo "=== fichier(s) nginx contenant rest/v1 ==="
grep -rl 'rest/v1' /etc/nginx/

echo
echo "=== bloc CORS dans la config active ==="
grep -n 'Access-Control\|proxy_hide_header\|location /auth\|location /rest' /etc/nginx/sites-available/ba9alino-api

echo
echo "=== TEST CURL via nginx (preflight auth) ==="
curl -sk -i -X OPTIONS "https://ba9alino.duckdns.org/auth/v1/token?grant_type=password" \
  -H "Origin: https://ba9alino.ma" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: x-client-info,apikey,content-type" \
  | grep -i 'access-control\|HTTP/'

echo
echo "=== TEST CURL via nginx (preflight rest/rpc) ==="
curl -sk -i -X OPTIONS "https://ba9alino.duckdns.org/rest/v1/rpc/superadmin_login" \
  -H "Origin: https://ba9alino.ma" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: x-client-info,apikey,content-type" \
  | grep -i 'access-control\|HTTP/'

echo
echo "=== ESPACE DISQUE ==="
df -h /
