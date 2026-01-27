-- Add TVA columns to orders table
-- This migration adds TVA-related columns to support tax calculations

DO $$
BEGIN
    -- Add tva_rate column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'tva_rate'
    ) THEN
        ALTER TABLE orders ADD COLUMN tva_rate DECIMAL(5,2) DEFAULT 0.00;
    END IF;
    
    -- Add tva_amount column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'tva_amount'
    ) THEN
        ALTER TABLE orders ADD COLUMN tva_amount DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Ensure subtotal column exists (it should exist from previous migration)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'subtotal'
    ) THEN
        ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- Update existing orders to have proper subtotal and TVA calculations
-- This is a one-time update for existing orders
UPDATE orders 
SET 
    subtotal = COALESCE(subtotal, total_amount),
    tva_rate = COALESCE(tva_rate, 0.00),
    tva_amount = COALESCE(tva_amount, 0.00)
WHERE 
    subtotal IS NULL OR 
    tva_rate IS NULL OR 
    tva_amount IS NULL;

-- Show the structure of the orders table to verify
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
    AND (column_name IN ('subtotal', 'total_amount', 'tva_rate', 'tva_amount'))
ORDER BY ordinal_position;
