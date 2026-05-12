-- Fix invoices.created_at: missing DEFAULT NOW() caused recent invoices to have NULL,
-- making them invisible/unsorted on the InvoicesPage.

-- 1) Add default
ALTER TABLE public.invoices ALTER COLUMN created_at SET DEFAULT NOW();

-- 2) Backfill NULLs using updated_at if present, else NOW()
UPDATE public.invoices
SET created_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL;

-- 3) Make NOT NULL to prevent future NULL inserts
ALTER TABLE public.invoices ALTER COLUMN created_at SET NOT NULL;

-- Sanity check
SELECT COUNT(*) AS total, COUNT(created_at) AS with_date FROM public.invoices;
