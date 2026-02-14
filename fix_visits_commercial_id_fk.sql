-- Fix foreign key constraint error on visits.commercial_id
-- The column references employees(id) but we use user_accounts IDs

-- Drop the FK constraint
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_commercial_id_fkey;

-- Verify the constraint is removed
-- \d visits
