-- Fix orders table - ensure all required columns exist
-- This migration checks and adds missing columns for the orders table

DO $$
BEGIN
    -- Check and add missing columns for orders table
    
    -- Add order_number if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'order_number'
    ) THEN
        ALTER TABLE orders ADD COLUMN order_number TEXT;
    END IF;
    
    -- Add client_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN client_id UUID REFERENCES clients(id);
    END IF;
    
    -- Add subtotal if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'subtotal'
    ) THEN
        ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Add total_amount if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE orders ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Add shipping_address if it doesn't exist (as JSONB)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shipping_address'
    ) THEN
        ALTER TABLE orders ADD COLUMN shipping_address JSONB;
    END IF;
    
    -- Add notes if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'notes'
    ) THEN
        ALTER TABLE orders ADD COLUMN notes TEXT;
    END IF;
    
    -- Add phone if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'phone'
    ) THEN
        ALTER TABLE orders ADD COLUMN phone TEXT;
    END IF;
    
    -- Add order_date if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'order_date'
    ) THEN
        ALTER TABLE orders ADD COLUMN order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- Add delivery_date if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'delivery_date'
    ) THEN
        ALTER TABLE orders ADD COLUMN delivery_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'status'
    ) THEN
        ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
    
    -- Add payment_status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;
    
    -- Add employee_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN employee_id UUID REFERENCES employees(id);
    END IF;
    
    -- Add warehouse_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'warehouse_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);
    END IF;
    
END $$;

-- Show current structure of orders table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;
