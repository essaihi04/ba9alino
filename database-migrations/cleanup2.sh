#!/bin/bash
find /opt/ba9alino/storage/product-images -type f | while read f; do
  if file "$f" | grep -q ": data$"; then
    echo "REMOVE: $f"
    rm "$f"
  fi
  if file "$f" | grep -q ": ASCII text"; then
    echo "REMOVE (text): $f"
    rm "$f"
  fi
done
echo "--- REMAINING ---"
find /opt/ba9alino/storage/product-images -type f | while read f; do
  echo "$(file "$f")"
done

# Clear stale image_url for products
sudo -u postgres psql -d ba9alino -c "UPDATE products SET image_url = NULL WHERE image_url LIKE '%Capturedd%' OR image_url LIKE '%ChatGPT%' OR image_url LIKE '%moalim%';"
