#!/bin/bash
echo "=== Testing direct storage server (port 3003) ==="
curl -sI "http://localhost:3003/object/public/product-images/products/1778456624807-Capturedd.PNG" | head -10

echo ""
echo "=== Testing via nginx (HTTPS) ==="
curl -sI "https://ba9alino.duckdns.org/storage/v1/object/public/product-images/products/1778456624807-Capturedd.PNG" | head -10

echo ""
echo "=== Storage server logs (last 20 lines) ==="
journalctl -u ba9alino-storage --no-pager -n 20 2>/dev/null || cat /var/log/ba9alino-storage.log 2>/dev/null || echo "No log found"

echo ""
echo "=== Nginx error log (last 10 lines) ==="
tail -10 /var/log/nginx/error.log 2>/dev/null
