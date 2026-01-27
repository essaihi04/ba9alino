-- =====================================================
-- COMPLETELY DISABLE RLS FOR COMPANY_INFO
-- Use this if the permissive policies don't work
-- =====================================================

-- Completely disable RLS for company_info table
ALTER TABLE company_info DISABLE ROW LEVEL SECURITY;

-- Remove all existing policies
DROP POLICY IF EXISTS "Users can view company info" ON company_info;
DROP POLICY IF EXISTS "Users can insert company info" ON company_info;
DROP POLICY IF EXISTS "Users can update company info" ON company_info;
DROP POLICY IF EXISTS "Users can delete company info" ON company_info;
DROP POLICY IF EXISTS "Enable insert for all users" ON company_info;
DROP POLICY IF EXISTS "Enable update for all users" ON company_info;
DROP POLICY IF EXISTS "Enable select for all users" ON company_info;
DROP POLICY IF EXISTS "Enable delete for all users" ON company_info;

-- Grant full permissions to all roles
GRANT ALL ON company_info TO authenticated;
GRANT ALL ON company_info TO service_role;
GRANT ALL ON company_info TO anon;
GRANT ALL ON company_info TO postgres;

-- Ensure table exists with correct structure
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

-- Insert default data if empty
INSERT INTO company_info (name_ar, name_en, address_ar, phone, email)
SELECT 
  'بقالينو',
  'Ba9alino',
  'العنوان الافتراضي',
  '212600000000',
  'contact@ba9alino.com'
WHERE NOT EXISTS (SELECT 1 FROM company_info);

COMMIT;
