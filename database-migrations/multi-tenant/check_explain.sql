SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","organization_id":"6db5963e-4412-4b07-bab5-80eb33bd1d7f","role":"ba9alino_anon"}',
  TRUE);
SET LOCAL ROLE ba9alino_anon;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, name_ar, sku, stock, price_a, image_url, is_active
FROM products
WHERE is_active = TRUE
ORDER BY name_ar;
