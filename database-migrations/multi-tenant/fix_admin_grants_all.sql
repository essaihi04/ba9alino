-- Grant full table privileges to ba9alino_admin on all current and future tables in public schema.
GRANT USAGE ON SCHEMA public TO ba9alino_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ba9alino_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ba9alino_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ba9alino_admin;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ba9alino_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ba9alino_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ba9alino_admin;
