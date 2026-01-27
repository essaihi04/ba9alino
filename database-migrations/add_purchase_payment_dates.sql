-- Migration: Add payment reminder fields to purchases
-- Run this in your Supabase SQL editor

DO $$
BEGIN
  -- Cheque / credit reminder dates
  ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS check_deposit_date DATE;
  ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS credit_due_date DATE;

  -- Cheque details (optional)
  ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS bank_name TEXT;
  ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS check_number TEXT;
  ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS check_date DATE;

  -- Payment tracking (optional but used by SupplierCreditsPage)
  ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS paid_amount NUMERIC;
  ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC;
  ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_status TEXT;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_check_deposit_date ON public.purchases(check_deposit_date);
CREATE INDEX IF NOT EXISTS idx_purchases_credit_due_date ON public.purchases(credit_due_date);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_type ON public.purchases(payment_type);
