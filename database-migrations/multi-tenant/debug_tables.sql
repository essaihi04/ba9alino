SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' 
AND (table_name LIKE '%invoice%' OR table_name LIKE '%line%' OR table_name LIKE '%item%') 
ORDER BY table_name;

-- Check rowcounts for each
SELECT 'invoice_items' AS t, COUNT(*) FROM invoice_items
UNION ALL SELECT 'invoice_lines', COUNT(*) FROM invoice_lines;
