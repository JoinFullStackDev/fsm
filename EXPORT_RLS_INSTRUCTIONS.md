# Export RLS Policies - Instructions

## Step 1: Run the Export Script

1. Open Supabase SQL Editor
2. Copy the entire contents of `migrations/EXPORT_ALL_RLS_POLICIES.sql`
3. Paste into SQL Editor
4. Click "Run" or press Cmd/Ctrl + Enter
5. **Copy all the results** (all sections)

## Step 2: Share the Results

Share the results with me. You can:
- Copy/paste the results here
- Or save to a file and share

## What This Will Show

The export script will show:
1. ✅ All tables with RLS enabled
2. ✅ All RLS policies (with full SQL expressions)
3. ✅ Functions used in policies
4. ✅ Policies using `user_organization_id()`
5. ✅ Potential recursive policies
6. ✅ Summary of policy counts per table

## Why This Helps

Instead of guessing what policies exist, we can:
- See the actual current state
- Identify problematic policies
- Build a targeted fix plan
- Avoid breaking working policies
- Ensure we fix everything correctly

## After You Share

I'll:
1. Analyze all the policies
2. Identify issues (recursion, missing policies, etc.)
3. Build a comprehensive fix plan
4. Create a migration that fixes everything properly

This is much better than guessing! 🎯

