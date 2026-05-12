#!/bin/bash
# Populate warehouse_stock from products.stock for all active warehouses
sudo -u postgres psql -d ba9alino <<'EOF'

-- Insert one row per product per warehouse using products.stock as quantity
-- ON CONFLICT: skip if already exists
INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, min_alert_level)
SELECT
  w.id AS warehouse_id,
  p.id AS product_id,
  COALESCE(p.stock, 0) AS quantity,
  0 AS min_alert_level
FROM products p
CROSS JOIN warehouses w
WHERE p.is_active = true
ON CONFLICT (warehouse_id, product_id) DO NOTHING;

SELECT COUNT(*) AS inserted_rows FROM warehouse_stock;
EOF
