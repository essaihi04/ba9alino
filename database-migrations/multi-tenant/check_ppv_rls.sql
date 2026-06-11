-- RLS status + column check on product_primary_variants
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('product_primary_variants', 'product_variants', 'product_categories');

SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'product_primary_variants';

-- Does it have organization_id?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'product_primary_variants' AND column_name = 'organization_id';

-- Count per org
SELECT p.organization_id, COUNT(ppv.id)
FROM product_primary_variants ppv
JOIN products p ON p.id = ppv.product_id
GROUP BY p.organization_id
ORDER BY COUNT(ppv.id) DESC
LIMIT 5;
