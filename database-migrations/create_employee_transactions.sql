-- Migration: Create employee transactions table
-- Run this in your Supabase SQL editor

-- Create table for employee financial transactions (advance, repayment, salary)
CREATE TABLE IF NOT EXISTS employee_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('advance', 'repayment', 'salary_payment', 'salary_deduction')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'check', 'card', 'other')),
  notes TEXT,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_transactions_employee_id ON employee_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_transactions_date ON employee_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_employee_transactions_type ON employee_transactions(transaction_type);

ALTER TABLE employee_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employee_transactions" ON employee_transactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert employee_transactions" ON employee_transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update employee_transactions" ON employee_transactions
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete employee_transactions" ON employee_transactions
  FOR DELETE USING (auth.role() = 'authenticated');

-- Employee finance configuration
ALTER TABLE employees ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS advance_limit DECIMAL(12, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_employees_monthly_salary ON employees(monthly_salary);
CREATE INDEX IF NOT EXISTS idx_employees_advance_limit ON employees(advance_limit);
