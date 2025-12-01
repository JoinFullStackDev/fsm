-- QUICK RECOVERY - Run these in order IMMEDIATELY when access is restored
-- This will get you back up and running in ~2 minutes

-- STEP 1: Disable RLS on users (BREAKS RECURSION - DO THIS FIRST)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop all broken policies on users
DROP POLICY IF EXISTS "Users can read own user record" ON users;
DROP POLICY IF EXISTS "Users can view their own organization users" ON users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
DROP POLICY IF EXISTS "Admins can update users in their organization" ON users;
DROP POLICY IF EXISTS "Users can insert own user record" ON users;
DROP POLICY IF EXISTS "Users can update own user record" ON users;

-- STEP 3: Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create basic policy (NO SUBQUERIES - avoids recursion)
CREATE POLICY "Users can read own user record"
  ON users FOR SELECT
  USING (auth.uid() = auth_id);

-- STEP 5: Create policy to read org users (uses simple subquery with LIMIT)
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    auth.uid() = auth_id
    OR
    organization_id = (
      SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

-- STEP 6: Allow inserts
CREATE POLICY "Users can insert own user record"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = auth_id);

-- STEP 7: Allow updates
CREATE POLICY "Users can update own user record"
  ON users FOR UPDATE
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- DONE - You should now be able to access the app
-- The app will work, though some features might need the full fix later

