-- Sync warehouse_stock.quantity with products.stock for products having a single warehouse row.
-- (Each product has at most 1 warehouse_stock row in this dataset.)

UPDATE public.warehouse_stock ws
SET quantity = p.stock,
    updated_at = NOW()
FROM public.products p
WHERE ws.product_id = p.id
  AND COALESCE(ws.quantity, 0) <> COALESCE(p.stock, 0);

SELECT COUNT(*) AS warehouse_stock_rows FROM warehouse_stock;
SELECT ws.quantity, p.stock FROM warehouse_stock ws JOIN products p ON p.id = ws.product_id
WHERE p.id = '72947015-f28b-4eb9-8f0f-766d6cb976e7';
