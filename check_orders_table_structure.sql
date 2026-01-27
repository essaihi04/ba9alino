-- =====================================================
-- CHECK ORDERS TABLE STRUCTURE
-- =====================================================

-- Check existing columns in orders table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;

-- Show sample data to understand current structure
SELECT * FROM orders LIMIT 1;

-- Check if delivery_address exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'delivery_address'
    ) THEN
        ALTER TABLE orders ADD COLUMN delivery_address TEXT;
        RAISE NOTICE 'Added delivery_address column to orders table';
    ELSE
        RAISE NOTICE 'delivery_address column already exists in orders table';
    END IF;
END $$;

-- Also check for other potentially missing columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'delivery_date'
    ) THEN
        ALTER TABLE orders ADD COLUMN delivery_date TEXT;
        RAISE NOTICE 'Added delivery_date column to orders table';
    END IF;
END $$;

COMMIT;
