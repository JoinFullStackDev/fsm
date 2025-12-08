/**
 * Session utility functions for checking authentication and user sessions
 */

import { createSupabaseClient } from '@/lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import logger from './logger';

export interface SessionResult {
  session: Session | null;
  user: User | null;
  userId: string | null;
  error: Error | null;
}

// User data from our database
interface DbUser {
  id: string;
  email: string;
  role: string;
  auth_id: string;
  name: string | null;
}

/**
 * Get the current session and user from Supabase
 * @returns Promise with session, user, userId, and error
 */
export async function getCurrentSession(): Promise<SessionResult> {
  const supabase = createSupabaseClient();
  
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.error('[Session] Error getting session:', sessionError);
      return {
        session: null,
        user: null,
        userId: null,
        error: sessionError,
      };
    }

    if (!session) {
      return {
        session: null,
        user: null,
        userId: null,
        error: null,
      };
    }

    // Also get user for more reliable auth check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      logger.warn('[Session] Error getting user:', userError);
    }

    return {
      session,
      user: user || session.user,
      userId: user?.id || session.user.id,
      error: null,
    };
  } catch (error) {
    logger.error('[Session] Unexpected error getting session:', error);
    return {
      session: null,
      user: null,
      userId: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get user record from database by auth_id
 * @param authId - The auth_id from Supabase session
 * @returns Promise with user data or null
 */
export async function getUserByAuthId(authId: string) {
  const supabase = createSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, auth_id, name')
      .eq('auth_id', authId)
      .single();

    if (error) {
      logger.error('[Session] Error getting user by auth_id:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    logger.error('[Session] Unexpected error getting user:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Check if user has required role
 * @param requiredRole - The role required (admin, pm, designer, engineer)
 * @returns Promise with hasAccess boolean and user data
 */
export async function checkRoleAccess(requiredRole: string): Promise<{
  hasAccess: boolean;
  user: DbUser | null;
  error: Error | null;
}> {
  const { session, userId, error: sessionError } = await getCurrentSession();
  
  if (sessionError || !userId) {
    return {
      hasAccess: false,
      user: null,
      error: sessionError || new Error('No session found'),
    };
  }

  const { data: user, error: userError } = await getUserByAuthId(userId);
  
  if (userError || !user) {
    return {
      hasAccess: false,
      user: null,
      error: userError || new Error('User not found'),
    };
  }

  const hasAccess = user.role === requiredRole || user.role === 'admin';
  
  return {
    hasAccess,
    user,
    error: null,
  };
}

