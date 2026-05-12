-- Check order_items columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'order_items' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check stock table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stock' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show a sample order with its items
SELECT 
  o.id AS order_id, o.status,
  oi.product_id, oi.variant_id, oi.quantity,
  s.id AS stock_id, s.quantity_in_stock, s.primary_variant_id
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN stock s ON s.product_id = oi.product_id
WHERE o.status = 'delivered'
LIMIT 5;
