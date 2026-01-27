-- Migration: Create expenses table
-- Run this in your Supabase SQL editor

-- Create table for general expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('rent', 'electricity', 'water', 'internet', 'transport', 'salary', 'other')),
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'check', 'card', 'other')),
  employee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_employee_id ON expenses(employee_id);

-- Add RLS policy
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all expenses
CREATE POLICY "Users can view expenses" ON expenses
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Users can insert expenses
CREATE POLICY "Users can insert expenses" ON expenses
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update expenses
CREATE POLICY "Users can update expenses" ON expenses
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: Users can delete expenses
CREATE POLICY "Users can delete expenses" ON expenses
  FOR DELETE USING (auth.role() = 'authenticated');
