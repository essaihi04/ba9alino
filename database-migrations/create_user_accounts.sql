-- Create user_accounts table for managing user accounts
-- Drop table if exists to recreate with new structure
DROP TABLE IF EXISTS user_accounts CASCADE;

CREATE TABLE user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employee', 'commercial')),
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL -- Optional link to auth user
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_accounts_username ON user_accounts(username);
CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_role ON user_accounts(role);
CREATE INDEX IF NOT EXISTS idx_user_accounts_employee_id ON user_accounts(employee_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_is_active ON user_accounts(is_active);

-- Enable Row Level Security
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Temporary permissive approach for debugging
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow all operations for testing" ON user_accounts;
DROP POLICY IF EXISTS "Service role full access" ON user_accounts;
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON user_accounts;
DROP POLICY IF EXISTS "Users can manage own account" ON user_accounts;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON user_accounts;
DROP POLICY IF EXISTS "Users can update own account" ON user_accounts;
DROP POLICY IF EXISTS "Users can delete own account" ON user_accounts;

-- Temporary policy to allow all operations for debugging
CREATE POLICY "Allow all operations for debugging" ON user_accounts
    FOR ALL USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access" ON user_accounts
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- Allow authenticated users to insert new accounts (for user creation)
CREATE POLICY "Allow insert for authenticated users" ON user_accounts
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
    );

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to authenticated users" ON user_accounts
    FOR SELECT USING (
        auth.role() = 'authenticated'
    );

-- Allow users to update their own account
CREATE POLICY "Users can update own account" ON user_accounts
    FOR UPDATE USING (
        auth.uid() = id
    );

-- Allow users to delete their own account
CREATE POLICY "Users can delete own account" ON user_accounts
    FOR DELETE USING (
        auth.uid() = id
    );

-- Function to update last_login
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_accounts 
    SET last_login = NOW() 
    WHERE id = auth.uid();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update last_login on login
DROP TRIGGER IF EXISTS on_auth_login ON auth.users;
CREATE TRIGGER on_auth_login
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION update_last_login();

-- Function to create user account after signup
CREATE OR REPLACE FUNCTION public.create_user_account()
RETURNS TRIGGER AS $$
BEGIN
    -- Update existing user account with auth user link
    UPDATE public.user_accounts 
    SET auth_user_id = NEW.id
    WHERE email = NEW.email;
    
    -- If no account exists, create one
    IF NOT FOUND THEN
        INSERT INTO public.user_accounts (id, username, email, full_name, role, auth_user_id)
        VALUES (
            gen_random_uuid(),
            COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
            NEW.id
        );
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- User account already exists, just update the link
        UPDATE public.user_accounts 
        SET auth_user_id = NEW.id
        WHERE email = NEW.email;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user account after user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    WHEN (NEW.raw_user_meta_data IS NOT NULL)
    EXECUTE FUNCTION public.create_user_account();
