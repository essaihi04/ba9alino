-- Migration: Create supplier payments table
-- Run this in your Supabase SQL editor

-- Create table for supplier payments
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'check', 'card', 'other')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_supplier_payments_supplier_id ON supplier_payments(supplier_id);
CREATE INDEX idx_supplier_payments_date ON supplier_payments(payment_date);

-- Add RLS policy
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all supplier payments
CREATE POLICY "Users can view supplier payments" ON supplier_payments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Users can insert supplier payments
CREATE POLICY "Users can insert supplier payments" ON supplier_payments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update supplier payments
CREATE POLICY "Users can update supplier payments" ON supplier_payments
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: Users can delete supplier payments
CREATE POLICY "Users can delete supplier payments" ON supplier_payments
  FOR DELETE USING (auth.role() = 'authenticated');
