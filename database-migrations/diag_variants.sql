-- Diagnostic : vue ou table ? + aperçu des lignes
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name IN ('product_primary_variants', 'product_variants');

-- Définition de product_primary_variants si c'est une vue
SELECT pg_get_viewdef('product_primary_variants', true) AS view_def;

-- Règles / triggers INSTEAD OF éventuels sur product_primary_variants
SELECT n.nspname AS schema, c.relname AS rel, r.rulename
FROM pg_rewrite r
JOIN pg_class c ON c.oid = r.ev_class
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'product_primary_variants';

-- Aperçu des vraies lignes
SELECT id, product_id, variant_name, barcode, is_default
FROM product_variants
ORDER BY product_id
LIMIT 10;
