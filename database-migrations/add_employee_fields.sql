-- Migration: Add additional fields to employees table
-- Run this in your Supabase SQL editor

-- Add new columns to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary DECIMAL(10, 2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_hire_date ON employees(hire_date);

-- Add constraints for data integrity
ALTER TABLE employees ADD CONSTRAINT IF NOT EXISTS salary_positive CHECK (salary >= 0 OR salary IS NULL);

-- Update existing employees with default hire_date if null
UPDATE employees SET hire_date = created_at::date WHERE hire_date IS NULL;
