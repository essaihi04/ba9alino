SELECT tablename, indexname
FROM pg_indexes
WHERE indexname LIKE '%org%'
ORDER BY tablename;
