SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE p.proname IN ('user_accounts_login', 'virtual_login', 'virtual_list_accounts');
