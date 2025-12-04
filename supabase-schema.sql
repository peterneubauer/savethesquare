-- Supabase schema for Save The Square donations
-- This file contains the SQL to create/update the donations table

-- Create donations table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_name TEXT NOT NULL,
    donor_email TEXT NOT NULL,
    donor_greeting TEXT,
    squares JSONB NOT NULL,
    amount NUMERIC NOT NULL,
    mode_data JSONB NOT NULL DEFAULT '{"mode": "click"}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_donations_timestamp ON donations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_donations_session_id ON donations(session_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor_email ON donations(donor_email);

-- Add GIN index for JSONB columns to enable efficient queries
CREATE INDEX IF NOT EXISTS idx_donations_squares ON donations USING GIN (squares);
CREATE INDEX IF NOT EXISTS idx_donations_mode_data ON donations USING GIN (mode_data);

-- Add comment to document the mode_data structure
COMMENT ON COLUMN donations.mode_data IS
'JSONB object containing donation mode metadata:
- mode: "click" or "text"
- For text mode, also includes:
  - text: string (the text displayed)
  - color: string (hex color code)
  - fontSize: number (font size in pixels)
  - pixelDensity: number (1-10, controls rendering detail)
  - pixelRadius: number (3-20, controls marker size)
  - zoom: number (map zoom level when text was created)';

-- Add comment to document the squares structure
COMMENT ON COLUMN donations.squares IS
'JSONB array of square keys in format ["lat_lng", "lat_lng", ...]
where lat and lng are multiplied by 100000';

-- Optional: Create a view to extract mode_data fields for easier querying
CREATE OR REPLACE VIEW donations_with_mode AS
SELECT
    id,
    donor_name,
    donor_email,
    donor_greeting,
    squares,
    amount,
    mode_data,
    mode_data->>'mode' AS mode,
    mode_data->>'text' AS text_content,
    mode_data->>'color' AS text_color,
    (mode_data->>'fontSize')::int AS font_size,
    (mode_data->>'pixelDensity')::int AS pixel_density,
    (mode_data->>'pixelRadius')::int AS pixel_radius,
    (mode_data->>'zoom')::int AS zoom_level,
    timestamp,
    session_id,
    payment_status,
    created_at,
    updated_at
FROM donations;

-- Optional: Add RLS (Row Level Security) policies if needed
-- ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Example policy: Allow public read access
-- CREATE POLICY "Allow public read access" ON donations
--     FOR SELECT USING (true);

-- Example policy: Allow authenticated insert
-- CREATE POLICY "Allow authenticated insert" ON donations
--     FOR INSERT WITH CHECK (true);

-- Optional: Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
