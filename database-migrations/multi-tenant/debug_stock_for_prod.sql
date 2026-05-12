-- Show ALL stock rows for this product
SELECT id, product_id, primary_variant_id, quantity_in_stock, warehouse_id, organization_id
FROM stock
WHERE product_id = '72947015-f28b-4eb9-8f0f-766d6cb976e7';

-- Show primary variants for this product
SELECT id, product_id, variant_name, is_active
FROM product_primary_variants
WHERE product_id = '72947015-f28b-4eb9-8f0f-766d6cb976e7';

-- Count stock rows by primary_variant_id NULL or not
SELECT 
  primary_variant_id IS NULL AS pv_null,
  COUNT(*)
FROM stock
GROUP BY 1;
