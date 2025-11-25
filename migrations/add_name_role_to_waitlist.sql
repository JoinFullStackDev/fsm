-- Add name and role columns to waitlist table if they don't exist
-- Run this in your Supabase SQL Editor if the table already exists without these columns

-- Add name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'waitlist' AND column_name = 'name'
  ) THEN
    ALTER TABLE waitlist ADD COLUMN name TEXT;
  END IF;
END $$;

-- Add role column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'waitlist' AND column_name = 'role'
  ) THEN
    ALTER TABLE waitlist ADD COLUMN role TEXT;
  END IF;
END $$;

