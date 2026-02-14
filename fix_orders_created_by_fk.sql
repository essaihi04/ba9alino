-- Fix foreign key constraint error on orders.created_by
-- The column references employees(id) but we use user_accounts IDs

-- Drop the FK constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_created_by_fkey;

-- Also check if there's a constraint on source column
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;

-- Verify the constraint is removed
-- \d orders
