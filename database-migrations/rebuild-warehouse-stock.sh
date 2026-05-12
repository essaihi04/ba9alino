#!/bin/bash
# Rebuild warehouse_stock only from received purchases
sudo -u postgres psql -d ba9alino <<'EOF'

-- 1) Check purchases
SELECT COUNT(*) AS received_purchases FROM purchases WHERE status = 'received';
SELECT COUNT(*) AS with_warehouse FROM purchases WHERE status = 'received' AND warehouse_id IS NOT NULL;
SELECT COUNT(*) AS without_warehouse FROM purchases WHERE status = 'received' AND warehouse_id IS NULL;

-- 2) Show first warehouse as default fallback
SELECT id, name FROM warehouses ORDER BY created_at LIMIT 1;

-- 3) Clear warehouse_stock
DELETE FROM warehouse_stock;

-- 4) Rebuild from purchases.items JSONB — each item has product_id and base_quantity/quantity
-- Uses COALESCE(warehouse_id, first_warehouse) for purchases without warehouse
WITH first_wh AS (
  SELECT id FROM warehouses ORDER BY created_at LIMIT 1
),
purchase_items AS (
  SELECT
    COALESCE(p.warehouse_id, fw.id) AS warehouse_id,
    (item->>'product_id')::uuid AS product_id,
    SUM(
      COALESCE((item->>'base_quantity')::numeric, (item->>'quantity')::numeric, 0)
    ) AS total_qty
  FROM purchases p
  CROSS JOIN first_wh fw
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.items) = 'array' THEN p.items ELSE '[]'::jsonb END
  ) AS item
  WHERE p.status = 'received'
    AND (item->>'product_id') IS NOT NULL
    AND (item->>'product_id') != ''
  GROUP BY COALESCE(p.warehouse_id, fw.id), (item->>'product_id')::uuid
)
INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, min_alert_level)
SELECT warehouse_id, product_id, GREATEST(total_qty, 0), 0
FROM purchase_items
WHERE product_id IS NOT NULL
ON CONFLICT (warehouse_id, product_id) DO UPDATE
  SET quantity = EXCLUDED.quantity;

-- 5) Final count
SELECT COUNT(*) AS rows_in_warehouse_stock FROM warehouse_stock;
SELECT SUM(quantity) AS total_units FROM warehouse_stock;

EOF
