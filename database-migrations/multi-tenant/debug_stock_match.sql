-- Recent invoice items: check product_id, primary_variant_id, qty
SELECT 
  i.invoice_number,
  ii.product_id,
  ii.primary_variant_id,
  ii.quantity,
  ii.unit_type,
  s.id AS stock_id,
  s.quantity_in_stock,
  s.primary_variant_id AS stock_pv_id
FROM invoices i
JOIN invoice_items ii ON ii.invoice_id = i.id
LEFT JOIN stock s ON s.product_id = ii.product_id
   AND ((ii.primary_variant_id IS NULL AND s.primary_variant_id IS NULL)
        OR s.primary_variant_id = ii.primary_variant_id)
WHERE i.created_at > NOW() - INTERVAL '4 hours'
ORDER BY i.created_at DESC
LIMIT 15;

-- Check invoice_items columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'invoice_items'
ORDER BY ordinal_position;
