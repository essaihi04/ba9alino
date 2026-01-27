-- Create order_drafts table for saving order drafts
CREATE TABLE IF NOT EXISTS order_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_data JSONB NOT NULL,
    order_items JSONB NOT NULL,
    selected_category_id TEXT,
    product_search_term TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'draft'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_drafts_created_at ON order_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_drafts_status ON order_drafts(status);

-- Enable Row Level Security
ALTER TABLE order_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to manage their own drafts
CREATE POLICY "Allow authenticated users to manage own drafts" ON order_drafts
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

-- Allow service role full access
CREATE POLICY "Service role full access" ON order_drafts
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_order_drafts_updated_at
    BEFORE UPDATE ON order_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
