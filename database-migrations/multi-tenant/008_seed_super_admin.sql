-- ============================================================================
-- 008 — Seed the SuperAdmin (zouhair / 1989Gr@04)
--
-- The password is hashed via pgcrypto bcrypt. To change later:
--   UPDATE super_admins
--   SET password_hash = crypt('NEW_PASSWORD', gen_salt('bf', 12))
--   WHERE username = 'zouhair';
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO super_admins (username, full_name, password_hash, is_active)
VALUES (
  'zouhair',
  'Zouhair (Super Admin)',
  crypt('1989Gr@04', gen_salt('bf', 12)),
  TRUE
)
ON CONFLICT (username) DO UPDATE
  SET password_hash = crypt('1989Gr@04', gen_salt('bf', 12)),
      is_active     = TRUE,
      full_name     = COALESCE(super_admins.full_name, EXCLUDED.full_name);
