-- Diagnose auth.users schema for confirmed_at
SELECT
  column_name,
  data_type,
  is_generated,
  generation_expression,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
  AND column_name IN ('confirmed_at','email_confirmed_at','phone_confirmed_at','created_at','updated_at');

-- Extra: show full column list + generated info
SELECT
  column_name,
  is_generated,
  generation_expression
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
ORDER BY ordinal_position;
