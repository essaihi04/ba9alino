#!/bin/bash
# Find all tables with uuid id column missing a default, then fix them
sudo -u postgres psql -d ba9alino <<'EOF'
-- Show tables missing uuid default
SELECT table_name, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND column_name='id'
  AND data_type='uuid'
  AND column_default IS NULL
ORDER BY table_name;

-- Fix all of them at once
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND column_name='id'
      AND data_type='uuid'
      AND column_default IS NULL
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT uuid_generate_v4()', tbl);
    RAISE NOTICE 'Fixed: %', tbl;
  END LOOP;
END;
$$;
EOF
