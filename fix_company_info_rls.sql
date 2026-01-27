-- =====================================================
-- FIX RLS POLICIES FOR COMPANY_INFO TABLE
-- =====================================================

-- First, disable RLS temporarily for company_info
ALTER TABLE company_info DISABLE ROW LEVEL SECURITY;

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  address_ar TEXT,
  address_en TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  tax_id TEXT,
  commercial_register TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS back
ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view company info" ON company_info;
DROP POLICY IF EXISTS "Users can insert company info" ON company_info;
DROP POLICY IF EXISTS "Users can update company info" ON company_info;
DROP POLICY IF EXISTS "Users can delete company info" ON company_info;

-- Create permissive policies for company_info
CREATE POLICY "Enable insert for all users" ON company_info
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON company_info
  FOR UPDATE USING (true);

CREATE POLICY "Enable select for all users" ON company_info
  FOR SELECT USING (true);

CREATE POLICY "Enable delete for all users" ON company_info
  FOR DELETE USING (true);

-- Grant necessary permissions
GRANT ALL ON company_info TO authenticated;
GRANT ALL ON company_info TO service_role;

-- Allow anonymous users to read company info (for invoices)
GRANT SELECT ON company_info TO anon;

-- Update function to handle updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at if it doesn't exist
DROP TRIGGER IF EXISTS update_company_info_updated_at ON company_info;
CREATE TRIGGER update_company_info_updated_at 
    BEFORE UPDATE ON company_info 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default company info if table is empty
INSERT INTO company_info (name_ar, name_en, address_ar, phone, email)
SELECT 
  'بقالينو',
  'Ba9alino',
  'العنوان الافتراضي',
  '212600000000',
  'contact@ba9alino.com'
WHERE NOT EXISTS (SELECT 1 FROM company_info);

COMMIT;
