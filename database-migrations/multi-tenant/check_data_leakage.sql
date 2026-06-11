-- 1) RLS status on key tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('products','product_categories','product_variants','suppliers','warehouses','promotions','coupons')
ORDER BY tablename;

-- 2) Products without organization_id
SELECT COUNT(*) AS products_no_org FROM products WHERE organization_id IS NULL;
SELECT COUNT(*) AS products_ba9alino FROM products WHERE organization_id = '6db5963e-4412-4b07-bab5-80eb33bd1d7f';
SELECT COUNT(*) AS products_test FROM products WHERE organization_id = '209ab928-d1bc-472c-8543-ba08dff73f5c';

-- 3) product_categories: has organization_id column?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'product_categories' AND column_name = 'organization_id';

-- 4) RLS policies on products and product_categories
SELECT tablename, policyname, cmd, qual FROM pg_policies
WHERE tablename IN ('products', 'product_categories')
ORDER BY tablename;

-- 5) product_categories: how many per org?
SELECT organization_id, COUNT(*) FROM product_categories GROUP BY organization_id ORDER BY COUNT(*) DESC LIMIT 10;
