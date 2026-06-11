-- Check existing FKs
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid = 'cash_sessions'::regclass AND contype = 'f';

-- Schema of cash_sessions
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'cash_sessions' ORDER BY ordinal_position;
