-- UPDATE SQL for existing Supabase donations table
-- Run this in Supabase SQL Editor to add indexes and documentation

-- =============================================================================
-- NO SCHEMA CHANGES NEEDED!
-- The mode_data JSONB column already supports the new fields:
-- - pixelDensity (number)
-- - pixelRadius (number)
-- These will be automatically included in new text-mode donations.
-- =============================================================================

-- Add/update comment to document the updated mode_data structure
COMMENT ON COLUMN donations.mode_data IS
'JSONB object containing donation mode metadata:
- mode: "click" or "text"
- For click mode: {"mode": "click"}
- For text mode, also includes:
  - text: string (the text displayed)
  - color: string (hex color code, e.g. "#FFD700")
  - fontSize: number (font size in pixels, 20-100)
  - pixelDensity: number (1-10, controls rendering detail)
  - pixelRadius: number (3-20, controls marker circle size in pixels)
  - zoom: number (map zoom level when text was created, typically 17-19)';

-- Add GIN index on mode_data if it doesn't exist (for efficient JSONB queries)
CREATE INDEX IF NOT EXISTS idx_donations_mode_data ON donations USING GIN (mode_data);

-- Add GIN index on squares if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_donations_squares ON donations USING GIN (squares);

-- Optional: Create/replace view to extract mode_data fields including new ones
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
    payment_status
FROM donations;

-- Verify the structure with a sample query
-- Uncomment to test:
-- SELECT
--     donor_name,
--     mode_data->>'mode' as mode,
--     mode_data->>'pixelDensity' as pixel_density,
--     mode_data->>'pixelRadius' as pixel_radius
-- FROM donations
-- WHERE mode_data->>'mode' = 'text'
-- LIMIT 5;
