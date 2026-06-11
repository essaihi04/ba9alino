-- Check product_variants RLS policies + org_id presence
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'product_variants';

SELECT COUNT(*) AS pv_no_org FROM product_variants WHERE organization_id IS NULL;
SELECT p.organization_id, COUNT(*) FROM product_variants pv
JOIN products p ON p.id = pv.product_id GROUP BY p.organization_id LIMIT 5;

-- Check column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'product_variants' AND column_name = 'organization_id';
