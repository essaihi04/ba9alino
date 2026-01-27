-- Fix invoices table - ensure TVA columns exist and are properly named
-- This migration ensures invoices table has the correct TVA-related columns

DO $$
BEGIN
    -- Add tax_rate column if it doesn't exist (alias for tva_rate)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'tax_rate'
    ) THEN
        ALTER TABLE invoices ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0.00;
    END IF;
    
    -- Add tax_amount column if it doesn't exist (alias for tva_amount)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'tax_amount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Ensure subtotal column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'subtotal'
    ) THEN
        ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Also add the alternative column names for compatibility
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'tva_rate'
    ) THEN
        ALTER TABLE invoices ADD COLUMN tva_rate DECIMAL(5,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'tva_amount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN tva_amount DECIMAL(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- Update existing invoices to have proper TVA calculations
-- This ensures consistency between tax_rate/tva_rate and tax_amount/tva_amount
UPDATE invoices 
SET 
    tax_rate = COALESCE(tax_rate, tva_rate, 0.00),
    tva_rate = COALESCE(tva_rate, tax_rate, 0.00),
    tax_amount = COALESCE(tax_amount, tva_amount, 0.00),
    tva_amount = COALESCE(tva_amount, tax_amount, 0.00),
    subtotal = COALESCE(subtotal, total_amount, 0.00)
WHERE 
    tax_rate IS NULL OR 
    tva_rate IS NULL OR 
    tax_amount IS NULL OR 
    tva_amount IS NULL OR
    subtotal IS NULL;

-- Show the structure of the invoices table to verify
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
    AND (column_name IN ('subtotal', 'total_amount', 'tax_rate', 'tva_rate', 'tax_amount', 'tva_amount'))
ORDER BY ordinal_position;
