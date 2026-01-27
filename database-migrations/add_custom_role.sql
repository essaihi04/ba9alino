-- Migration: Add custom_role field to employees table
-- Run this in your Supabase SQL editor

-- Add custom_role column for custom roles
ALTER TABLE employees ADD COLUMN IF NOT EXISTS custom_role VARCHAR(255);

-- Update the role column to allow 'custom' value
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check 
  CHECK (role IN ('admin', 'commercial', 'stock', 'truck_driver', 'delivery_driver', 'custom'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_employees_custom_role ON employees(custom_role);

-- Add constraint to ensure custom_role is provided when role is 'custom'
ALTER TABLE employees ADD CONSTRAINT IF NOT EXISTS custom_role_required 
  CHECK (role != 'custom' OR (role = 'custom' AND custom_role IS NOT NULL AND custom_role != ''));
