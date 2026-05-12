#!/bin/bash
sudo -u postgres psql -d ba9alino <<'EOF'
-- Count active vs inactive
SELECT is_active, COUNT(*) FROM products GROUP BY is_active;

-- Products inactive but with prices set (price_a > 0)
SELECT COUNT(*) AS inactive_with_prices
FROM products
WHERE is_active = false
  AND (price_a > 0 OR price_b > 0 OR price_c > 0 OR price_d > 0 OR price_e > 0);

-- Sample of inactive products with prices
SELECT id, name_ar, sku, price_a, price_b, price_c, price_d, price_e
FROM products
WHERE is_active = false
  AND (price_a > 0 OR price_b > 0 OR price_c > 0 OR price_d > 0 OR price_e > 0)
ORDER BY name_ar
LIMIT 10;
EOF
