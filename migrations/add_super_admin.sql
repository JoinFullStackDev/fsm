-- Add super admin functionality
-- This makes info@joinfullstack a super admin that cannot be deleted
-- and ensures everyone uses the super admin's API credentials

-- Add is_super_admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Set info@joinfullstack as super admin
UPDATE users 
SET is_super_admin = TRUE, role = 'admin'
WHERE email = 'info@joinfullstack.com';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin) WHERE is_super_admin = TRUE;

-- Add comment
COMMENT ON COLUMN users.is_super_admin IS 'Super admin users cannot be deleted and their API credentials are used system-wide';

