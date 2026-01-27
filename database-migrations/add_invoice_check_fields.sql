-- Migration: Add cheque fields to invoices table
-- Run this in your Supabase SQL editor

DO $$
BEGIN
  -- Add cheque-related columns to invoices table
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS check_number TEXT;
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS bank_name_ar TEXT;
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS check_date DATE;
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS check_deposit_date DATE;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_check_deposit_date ON public.invoices(check_deposit_date);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_method_check ON public.invoices(payment_method) WHERE payment_method IN ('check', 'cheque');
