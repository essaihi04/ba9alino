#!/bin/bash
FILE="/opt/ba9alino/storage/product-images/products/1778456624807-Capturedd.PNG"
echo "=== File info ==="
ls -la "$FILE"
file "$FILE"
echo ""
echo "=== First 16 bytes (PNG magic: 89 50 4E 47) ==="
xxd "$FILE" | head -2
echo ""
echo "=== File size check ==="
wc -c "$FILE"
echo ""
echo "=== Check all files in product-images ==="
find /opt/ba9alino/storage/product-images -type f -exec sh -c 'echo "$(wc -c < "$1") bytes - $1 - $(file "$1")"' _ {} \;
