-- Use Supabase Admin API to reset password
SELECT auth.admin.update_user(
  id := (SELECT id FROM auth.users WHERE email = 'pipo@example.com'),
  email := 'pipo@example.com',
  password := '123456',
  email_confirm := true
);
