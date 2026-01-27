-- Fix products table - ensure price columns exist and have default values
-- This migration ensures all price columns exist and updates null values to reasonable defaults

-- First, check if price columns exist, add them if they don't
DO $$
BEGIN
    -- Add price column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'price'
    ) THEN
        ALTER TABLE products ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Add price_a column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'price_a'
    ) THEN
        ALTER TABLE products ADD COLUMN price_a DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Add price_b column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'price_b'
    ) THEN
        ALTER TABLE products ADD COLUMN price_b DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Add price_c column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'price_c'
    ) THEN
        ALTER TABLE products ADD COLUMN price_c DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Add price_d column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'price_d'
    ) THEN
        ALTER TABLE products ADD COLUMN price_d DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Add price_e column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'price_e'
    ) THEN
        ALTER TABLE products ADD COLUMN price_e DECIMAL(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- Update null prices to reasonable defaults (you can adjust these values)
UPDATE products 
SET 
    price = COALESCE(price, 10.00),  -- Default base price
    price_a = COALESCE(price_a, price, 10.00),  -- Tier A gets base price or price_a
    price_b = COALESCE(price_b, price * 1.1, 11.00),  -- Tier B gets 10% more
    price_c = COALESCE(price_c, price * 1.2, 12.00),  -- Tier C gets 20% more
    price_d = COALESCE(price_d, price * 1.3, 13.00),  -- Tier D gets 30% more
    price_e = COALESCE(price_e, price * 1.5, 15.00)   -- Tier E gets 50% more
WHERE 
    price IS NULL OR 
    price_a IS NULL OR 
    price_b IS NULL OR 
    price_c IS NULL OR 
    price_d IS NULL OR 
    price_e IS NULL;

-- Show sample of updated products
SELECT 
    id, 
    name_ar, 
    sku, 
    price, 
    price_a, 
    price_b, 
    price_c, 
    price_d, 
    price_e 
FROM products 
LIMIT 5;
