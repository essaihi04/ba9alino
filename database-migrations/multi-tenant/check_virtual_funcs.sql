-- Check all virtual_* functions
SELECT proname, prosrc FROM pg_proc
WHERE proname IN ('virtual_list_accounts', 'virtual_create_account', 'virtual_delete_account', 'virtual_login')
ORDER BY proname;
