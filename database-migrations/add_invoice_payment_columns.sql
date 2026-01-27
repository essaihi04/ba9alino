-- Add missing payment-related columns to invoices table
-- This migration adds columns for storing payment details when payment method is check or debt

DO $$
BEGIN
    -- Add payment_method column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'payment_method'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE invoices ADD COLUMN payment_method TEXT;
    END IF;

    -- Add bank_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'bank_name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE invoices ADD COLUMN bank_name TEXT;
    END IF;

    -- Add check_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'check_number'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE invoices ADD COLUMN check_number TEXT;
    END IF;

    -- Add check_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'check_date'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE invoices ADD COLUMN check_date DATE;
    END IF;

    -- Add debt_due_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'debt_due_date'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE invoices ADD COLUMN debt_due_date DATE;
    END IF;

    -- Also add these columns to orders table if they don't exist
    -- payment_method for orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'payment_method'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE orders ADD COLUMN payment_method TEXT;
    END IF;

    -- bank_name for orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'bank_name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE orders ADD COLUMN bank_name TEXT;
    END IF;

    -- check_number for orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'check_number'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE orders ADD COLUMN check_number TEXT;
    END IF;

    -- check_date for orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'check_date'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE orders ADD COLUMN check_date DATE;
    END IF;

    -- debt_due_date for orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'debt_due_date'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE orders ADD COLUMN debt_due_date DATE;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_payment_method ON invoices(payment_method);
CREATE INDEX IF NOT EXISTS idx_invoices_bank_name ON invoices(bank_name);
CREATE INDEX IF NOT EXISTS idx_invoices_check_number ON invoices(check_number);
CREATE INDEX IF NOT EXISTS idx_invoices_check_date ON invoices(check_date);
CREATE INDEX IF NOT EXISTS idx_invoices_debt_due_date ON invoices(debt_due_date);

CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_bank_name ON orders(bank_name);
CREATE INDEX IF NOT EXISTS idx_orders_check_number ON orders(check_number);
CREATE INDEX IF NOT EXISTS idx_orders_check_date ON orders(check_date);
CREATE INDEX IF NOT EXISTS idx_orders_debt_due_date ON orders(debt_due_date);

-- Add comments for documentation
COMMENT ON COLUMN invoices.payment_method IS 'Payment method: cash, cheque, or credit';
COMMENT ON COLUMN invoices.bank_name IS 'Bank name for check payments';
COMMENT ON COLUMN invoices.check_number IS 'Check number for check payments';
COMMENT ON COLUMN invoices.check_date IS 'Check date for check payments';
COMMENT ON COLUMN invoices.debt_due_date IS 'Due date for debt/credit payments';

COMMENT ON COLUMN orders.payment_method IS 'Payment method: cash, cheque, or credit';
COMMENT ON COLUMN orders.bank_name IS 'Bank name for check payments';
COMMENT ON COLUMN orders.check_number IS 'Check number for check payments';
COMMENT ON COLUMN orders.check_date IS 'Check date for check payments';
COMMENT ON COLUMN orders.debt_due_date IS 'Due date for debt/credit payments';
