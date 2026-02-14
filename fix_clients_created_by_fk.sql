-- Fix foreign key constraint error on clients.created_by
-- The column references employees(id) but we use user_accounts IDs

-- Solution 1: Drop the FK constraint (recommended for flexibility)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_created_by_fkey;

-- Alternative Solution 2: If you want to keep tracking but allow user_accounts IDs
-- Create a separate column for user_accounts ID
-- ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

-- Verify the constraint is removed
-- \d clients
