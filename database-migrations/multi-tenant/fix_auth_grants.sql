-- Auth service runs as ba9alino_admin and queries user_accounts.
-- Ensure it has the necessary privileges.
GRANT USAGE ON SCHEMA public TO ba9alino_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_accounts TO ba9alino_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO ba9alino_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_members TO ba9alino_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ba9alino_admin;

-- Verify
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name='user_accounts' AND grantee='ba9alino_admin';
