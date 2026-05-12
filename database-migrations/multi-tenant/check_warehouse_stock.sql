-- Schema of warehouse_stock
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'warehouse_stock' ORDER BY ordinal_position;

-- Current warehouse_stock for سفة كنز 1/2
SELECT ws.id, ws.warehouse_id, w.name AS wh_name, ws.product_id, ws.quantity
FROM warehouse_stock ws
LEFT JOIN warehouses w ON w.id = ws.warehouse_id
WHERE ws.product_id = '72947015-f28b-4eb9-8f0f-766d6cb976e7';

-- Count warehouse_stock rows
SELECT COUNT(*) FROM warehouse_stock;
