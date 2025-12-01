import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Create a Supabase admin client with service role key
 * This bypasses RLS and allows admin operations like creating users
 * 
 * SECURITY WARNING: This bypasses Row Level Security (RLS) policies.
 * 
 * REQUIREMENTS BEFORE USE:
 * 1. Verify user is authenticated (check supabase.auth.getUser())
 * 2. Verify user has proper authorization (check role, permissions, organization access)
 * 3. Only use in server-side API routes, never in client components
 * 4. Log admin operations for audit purposes
 * 
 * APPROPRIATE USE CASES:
 * - Creating user records during signup/auth flows (after auth verification)
 * - Admin operations that require bypassing RLS (after role verification)
 * - Webhook handlers (after signature verification)
 * - System operations (cron jobs, etc.)
 * 
 * INAPPROPRIATE USE CASES:
 * - Regular user operations (use createServerSupabaseClient instead)
 * - Client-side code
 * - Operations without authorization checks
 */
export function createAdminSupabaseClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

