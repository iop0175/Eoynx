-- Add extended fields to items table for the new Add flow
-- Category, Brand, Hashtags, Price support

-- Add category field
ALTER TABLE items ADD COLUMN IF NOT EXISTS category text;

-- Add brand field
ALTER TABLE items ADD COLUMN IF NOT EXISTS brand text;

-- Add hashtags as text array
ALTER TABLE items ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}';

-- Add price fields (store in minor units for accuracy)
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_minor integer;
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_currency text DEFAULT 'USD';

-- Add multiple images support (array of URLs)
-- First image is the primary/thumbnail
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- Create index for hashtags search
CREATE INDEX IF NOT EXISTS idx_items_hashtags ON items USING GIN (hashtags);

-- Create index for category search
CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);

-- Create index for brand search  
CREATE INDEX IF NOT EXISTS idx_items_brand ON items (brand);

-- Add comment for documentation
COMMENT ON COLUMN items.category IS 'Item category (e.g., Luxury, Electronics)';
COMMENT ON COLUMN items.brand IS 'Brand name (e.g., HERMÈS, Apple)';
COMMENT ON COLUMN items.hashtags IS 'Array of hashtags without # symbol';
COMMENT ON COLUMN items.price_minor IS 'Price in minor units (cents for USD)';
COMMENT ON COLUMN items.price_currency IS 'ISO 4217 currency code';
COMMENT ON COLUMN items.image_urls IS 'Array of image URLs, first is primary';
