import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Server-side Supabase client
// Uses the same cookie interface as middleware for consistency
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  
  // Use the same cookie interface as middleware (get/set/remove)
  // This ensures sessions are read correctly in API routes
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set(name, value, options);
        } catch (error) {
          // Ignore errors - cookies might be read-only in some contexts
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set(name, '', { ...options, expires: new Date(0) });
        } catch (error) {
          // Ignore errors - cookies might be read-only in some contexts
        }
      },
    },
  });
}

