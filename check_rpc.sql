-- Check if RPC was updated
SELECT 
    proname AS function_name,
    prosrc AS source_code
FROM pg_proc 
WHERE proname = 'create_user_account_with_employee';

-- Also check if it contains the new fields
SELECT 
    prosrc
FROM pg_proc 
WHERE proname = 'create_user_account_with_employee'
  AND prosrc LIKE '%created_at%';
