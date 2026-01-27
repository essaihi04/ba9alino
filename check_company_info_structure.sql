-- =====================================================
-- CHECK AND FIX COMPANY_INFO TABLE STRUCTURE
-- =====================================================

-- First, check if table exists and its structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'company_info' 
ORDER BY ordinal_position;

-- If table doesn't exist or has wrong structure, drop and recreate
DROP TABLE IF EXISTS company_info CASCADE;

-- Create the table with correct structure
CREATE TABLE company_info (
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
  description_ar TEXT,
  description_en TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS completely for this table
ALTER TABLE company_info DISABLE ROW LEVEL SECURITY;

-- Grant permissions to all roles
GRANT ALL ON company_info TO authenticated;
GRANT ALL ON company_info TO service_role;
GRANT ALL ON company_info TO anon;
GRANT ALL ON company_info TO postgres;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_company_info_updated_at ON company_info;
CREATE TRIGGER update_company_info_updated_at 
    BEFORE UPDATE ON company_info 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default company info
INSERT INTO company_info (name_ar, name_en, address_ar, phone, email)
VALUES (
  'بقالينو',
  'Ba9alino',
  'المغرب - العنوان الافتراضي',
  '212600000000',
  'contact@ba9alino.com'
);

-- Verify the table was created correctly
SELECT * FROM company_info LIMIT 1;

COMMIT;
