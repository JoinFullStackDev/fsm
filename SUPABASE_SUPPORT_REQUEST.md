# URGENT: Database Locked - RLS Policy Recursion

## Problem Summary
Database is completely locked due to infinite recursion in Row Level Security (RLS) policies. All connections are blocked, cannot access dashboard, cannot run queries, cannot restore backups.

## What Happened
1. Ran migrations to fix RLS recursion issues
2. The migrations created RLS policies that query the `users` table
3. The `users` table policies are broken/missing, causing infinite recursion
4. All database connections are now stuck in recursive queries
5. Cannot access Supabase dashboard (infinite loading)
6. Cannot run SQL queries (connection timeouts)
7. Cannot restore backups (timeouts)

## What We Need
**URGENT: Please kill all active database connections and allow us to disable RLS on the `users` table.**

## Root Cause
The RLS policies on other tables (projects, dashboards, etc.) query the `users` table to get `organization_id`. However, the `users` table itself has broken/missing RLS policies, causing:
- Policy evaluation → queries users table → blocked by RLS → tries to evaluate policy → infinite loop

## Solution Steps (After connections are killed)
1. Disable RLS on `users` table: `ALTER TABLE users DISABLE ROW LEVEL SECURITY;`
2. Fix `users` table policies
3. Re-enable RLS with proper policies

## Database Details
- Project: [YOUR_PROJECT_NAME]
- Region: [YOUR_REGION]
- Issue started: [TIMESTAMP]

## Files Available
We have prepared fix scripts:
- `migrations/MINIMAL_FIX_USERS_ONLY.sql` - Minimal fix to break recursion
- `migrations/COMPREHENSIVE_RLS_FIX.sql` - Complete RLS policy fix

## Request
Please:
1. Kill all active database connections
2. Allow us to run: `ALTER TABLE users DISABLE ROW LEVEL SECURITY;`
3. Or if possible, run this command on our behalf to restore access

Thank you for urgent assistance.

