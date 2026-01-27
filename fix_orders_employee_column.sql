-- =====================================================
-- FIX ORDERS TABLE - EMPLOYEE COLUMN ISSUES
-- =====================================================

-- Check if created_by column exists in orders table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'created_by';

-- Add created_by column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE orders ADD COLUMN created_by UUID REFERENCES employees(id);
        RAISE NOTICE 'Added created_by column to orders table';
    ELSE
        RAISE NOTICE 'created_by column already exists in orders table';
    END IF;
END $$;

-- Check if warehouse_id column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'warehouse_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);
        RAISE NOTICE 'Added warehouse_id column to orders table';
    END IF;
END $$;

-- Check if client_id column exists and is properly named
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'client_id'
    ) THEN
        -- Check if there's a similar column with different name
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'orders' AND column_name LIKE '%client%'
        ) THEN
            -- Rename existing client column to client_id
            DECLARE 
                existing_client_col TEXT;
            BEGIN
                SELECT column_name INTO existing_client_col
                FROM information_schema.columns 
                WHERE table_name = 'orders' AND column_name LIKE '%client%'
                LIMIT 1;
                
                EXECUTE format('ALTER TABLE orders RENAME COLUMN %I TO client_id', existing_client_col);
                RAISE NOTICE 'Renamed existing client column to client_id';
            END;
        ELSE
            -- Add new client_id column
            ALTER TABLE orders ADD COLUMN client_id UUID REFERENCES clients(id);
            RAISE NOTICE 'Added client_id column to orders table';
        END IF;
    END IF;
END $$;

-- Verify all required columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('created_by', 'client_id', 'warehouse_id', 'delivery_address', 'delivery_date')
ORDER BY column_name;

-- Update existing orders to set default employee if created_by is null
UPDATE orders 
SET created_by = (
    SELECT id 
    FROM employees 
    WHERE role = 'admin' 
    LIMIT 1
) 
WHERE created_by IS NULL;

COMMIT;
