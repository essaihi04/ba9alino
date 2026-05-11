#!/bin/bash
echo "=== Deleting corrupted image files ==="
# Remove all files identified as 'data' (corrupted - not valid image format)
find /opt/ba9alino/storage/product-images -type f | while read f; do
  filetype=$(file "$f")
  if echo "$filetype" | grep -q ": data$"; then
    echo "DELETING corrupted: $f"
    rm "$f"
  else
    echo "OK: $f ($filetype)"
  fi
done

echo ""
echo "=== Also clear image_url from DB for products with corrupted images ==="
# Reset image_url for products that had corrupted files
sudo -u postgres psql -d ba9alino <<'SQL'
-- Find products whose image_url points to product-images and clear them
-- so user can re-upload
UPDATE products 
SET image_url = NULL 
WHERE image_url LIKE '%product-images/products/%'
  AND id IN (
    SELECT id FROM products 
    WHERE image_url LIKE '%1778456624807%'
       OR image_url LIKE '%1778457268591%'
       OR image_url LIKE '%1778457117186%'
  );
SELECT id, name_ar, sku, image_url FROM products WHERE name_ar = 'test';
SQL
