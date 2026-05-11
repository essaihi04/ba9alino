#!/bin/bash
for f in /opt/ba9alino/storage/product-images/products/*; do
  echo "=== $f ==="
  file "$f"
  echo "--- first 250 bytes (od -c) ---"
  head -c 250 "$f" | od -c | head -8
  echo ""
done
