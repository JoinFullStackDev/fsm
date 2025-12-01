/**
 * User Query Utilities
 * Always uses admin client to bypass RLS and prevent recursion
 * IMPORTANT: Always filter by auth_id or organization_id to maintain security
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type { User } from '@/types/project';

/**
 * Get user record by auth_id (bypasses RLS)
 * This is safe because auth_id is unique per user
 */
export async function getUserByAuthId(authId: string): Promise<User | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();

    if (error || !data) {
      logger.warn('[UserQueries] User not found:', { authId, error: error?.message });
      return null;
    }

    return data as User;
  } catch (error) {
    logger.error('[UserQueries] Error getting user by auth_id:', error);
    return null;
  }
}

/**
 * Get user's organization_id (bypasses RLS)
 */
export async function getUserOrganizationId(authId: string): Promise<string | null> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from('users')
      .select('organization_id')
      .eq('auth_id', authId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.organization_id;
  } catch (error) {
    logger.error('[UserQueries] Error getting organization_id:', error);
    return null;
  }
}

/**
 * Get users by organization_id (bypasses RLS but filters by org)
 * This is safe because we're filtering by organization_id
 */
export async function getUsersByOrganization(organizationId: string): Promise<User[]> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from('users')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) {
      logger.error('[UserQueries] Error getting users by organization:', error);
      return [];
    }

    return (data || []) as User[];
  } catch (error) {
    logger.error('[UserQueries] Error getting users by organization:', error);
    return [];
  }
}

