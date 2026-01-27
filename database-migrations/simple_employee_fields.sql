-- Migration: Simple employee fields setup
-- Run this in your Supabase SQL editor

-- Add all missing columns to employees table (basic version)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS national_id VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary DECIMAL(10, 2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS custom_role VARCHAR(255);

-- Update the role column to allow all values including 'custom'
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_role_check') THEN
        ALTER TABLE employees DROP CONSTRAINT employees_role_check;
    END IF;
END $$;

ALTER TABLE employees ADD CONSTRAINT employees_role_check 
  CHECK (role IN ('admin', 'commercial', 'stock', 'truck_driver', 'delivery_driver', 'custom'));

-- Add basic indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_address ON employees(address);
CREATE INDEX IF NOT EXISTS idx_employees_national_id ON employees(national_id);
CREATE INDEX IF NOT EXISTS idx_employees_hire_date ON employees(hire_date);
CREATE INDEX IF NOT EXISTS idx_employees_custom_role ON employees(custom_role);

-- Update existing employees with default values if null
UPDATE employees SET hire_date = created_at::date WHERE hire_date IS NULL;
