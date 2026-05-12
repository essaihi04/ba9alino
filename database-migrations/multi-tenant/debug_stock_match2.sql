-- Find recent invoice items + matching stock rows
SELECT 
  i.invoice_number,
  ii.product_id,
  ii.variant_id,
  ii.quantity,
  s.id AS stock_id,
  s.quantity_in_stock,
  s.primary_variant_id AS stock_pv_id
FROM invoices i
JOIN invoice_items ii ON ii.invoice_id = i.id
LEFT JOIN stock s ON s.product_id = ii.product_id
WHERE i.created_at > NOW() - INTERVAL '6 hours'
ORDER BY i.created_at DESC
LIMIT 15;

-- For one specific recent product, show ALL stock rows
SELECT s.id, s.product_id, s.primary_variant_id, s.quantity_in_stock
FROM stock s
WHERE s.product_id IN (
  SELECT ii.product_id FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.created_at > NOW() - INTERVAL '6 hours'
  LIMIT 3
)
ORDER BY s.product_id, s.primary_variant_id NULLS FIRST;
