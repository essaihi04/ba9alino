-- Check if RPC was updated with created_at field
SELECT 
    prosrc LIKE '%created_at%' AS has_created_at,
    prosrc LIKE '%updated_at%' AS has_updated_at,
    length(prosrc) AS code_length
FROM pg_proc 
WHERE proname = 'create_user_account_with_employee';
