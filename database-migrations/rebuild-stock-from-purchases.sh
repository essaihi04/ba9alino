#!/bin/bash
sudo -u postgres psql -d ba9alino <<'EOF'

-- 1) Add warehouse_id to purchases table (for future purchases)
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL;

-- 2) Clear warehouse_stock
DELETE FROM warehouse_stock;

-- 3) Rebuild warehouse_stock from purchases.items JSONB
-- All old purchases (no warehouse_id) → first warehouse
WITH first_wh AS (
  SELECT id FROM warehouses ORDER BY created_at LIMIT 1
),
expanded AS (
  SELECT
    COALESCE(p.warehouse_id, fw.id) AS warehouse_id,
    (item->>'product_id')::uuid AS product_id,
    COALESCE((item->>'base_quantity')::numeric, (item->>'quantity')::numeric, 0) AS qty
  FROM purchases p
  CROSS JOIN first_wh fw
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.items) = 'array' THEN p.items ELSE '[]'::jsonb END
  ) AS item
  WHERE p.status = 'received'
    AND (item->>'product_id') IS NOT NULL
    AND (item->>'product_id') != ''
),
aggregated AS (
  SELECT warehouse_id, product_id, SUM(qty) AS total_qty
  FROM expanded
  WHERE product_id IS NOT NULL
  GROUP BY warehouse_id, product_id
)
INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, min_alert_level)
SELECT warehouse_id, product_id, GREATEST(total_qty, 0), 0
FROM aggregated
ON CONFLICT (warehouse_id, product_id) DO UPDATE
  SET quantity = EXCLUDED.quantity;

-- 4) Update purchases without warehouse_id to use first warehouse
UPDATE purchases SET warehouse_id = (SELECT id FROM warehouses ORDER BY created_at LIMIT 1)
WHERE warehouse_id IS NULL AND status = 'received';

-- 5) Results
SELECT COUNT(*) AS rows_in_warehouse_stock FROM warehouse_stock;
SELECT SUM(quantity) AS total_units FROM warehouse_stock;
SELECT COUNT(*) AS purchases_with_warehouse FROM purchases WHERE warehouse_id IS NOT NULL;

EOF
