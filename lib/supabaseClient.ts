'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useMemo } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Singleton client instance
let clientInstance: ReturnType<typeof createBrowserClient> | null = null;
let listenerAttached = false;

// Client-side Supabase client (singleton pattern)
export function createSupabaseClient() {
  // Return existing instance if available
  if (clientInstance) {
    return clientInstance;
  }
  
  const client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  
  // Set up auth state change listener (only once)
  if (typeof window !== 'undefined' && !listenerAttached) {
    client.auth.onAuthStateChange((event, session) => {
      // Auth state change handler
    });
    listenerAttached = true;
  }
  
  clientInstance = client;
  return client;
}

// Hook version that memoizes the client
export function useSupabaseClient() {
  return useMemo(() => createSupabaseClient(), []);
}
