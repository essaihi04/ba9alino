#!/bin/bash
echo "=== Nginx config for storage ==="
cat /etc/nginx/sites-enabled/ba9alino 2>/dev/null || cat /etc/nginx/conf.d/ba9alino.conf 2>/dev/null | grep -A 20 "storage"

echo ""
echo "=== Full nginx config ==="
cat /etc/nginx/sites-enabled/ba9alino 2>/dev/null || cat /etc/nginx/conf.d/ba9alino.conf 2>/dev/null

echo ""
echo "=== Test file headers with curl (verbose) ==="
curl -v "https://ba9alino.duckdns.org/storage/v1/object/public/product-images/products/1778456624807-Capturedd.PNG" 2>&1 | head -40
