ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS check_deposit_date text;
NOTIFY pgrst, 'reload schema';
