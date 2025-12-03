/**
 * Company Admin utility functions
 * Provides helpers for company admin (organization admin) operations
 */

import { createServerSupabaseClient } from './supabaseServer';
import { createAdminSupabaseClient } from './supabaseAdmin';
import { unauthorized, forbidden } from './utils/apiErrors';
import logger from './utils/logger';
import type { NextRequest } from 'next/server';

/**
 * Require company admin access - throws error if not company admin
 * Company admins are organization admins (not super admins)
 * @param request - Next.js request object
 * @returns User ID and organization ID if company admin
 */
export async function requireCompanyAdmin(request: NextRequest): Promise<{ 
  userId: string; 
  organizationId: string;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw unauthorized('You must be logged in');
  }

  // Get user record to check company admin status
  let userData;
  const { data: regularUserData, error: regularUserError } = await supabase
    .from('users')
    .select('id, role, is_super_admin, is_company_admin, organization_id')
    .eq('auth_id', user.id)
    .single();

  if (regularUserError || !regularUserData) {
    const adminClient = createAdminSupabaseClient();
    const { data: adminUserData, error: adminUserError } = await adminClient
      .from('users')
      .select('id, role, is_super_admin, is_company_admin, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (adminUserError || !adminUserData) {
      throw unauthorized('User not found');
    }

    userData = adminUserData;
  } else {
    userData = regularUserData;
  }

  // Check company admin access
  // Company admin = is_company_admin = true (organization admin, not super admin)
  // Fallback: users with role = 'admin' and is_super_admin = false are also company admins
  const isCompanyAdmin = userData.is_company_admin === true;
  const isLegacyAdmin = userData.role === 'admin' && userData.is_super_admin === false;
  
  if (!isCompanyAdmin && !isLegacyAdmin) {
    throw forbidden('Company admin access required');
  }

  if (!userData.organization_id) {
    throw forbidden('User is not assigned to an organization');
  }

  return { 
    userId: userData.id,
    organizationId: userData.organization_id,
  };
}

/**
 * Check if user is a company admin
 * @param userId - User database ID
 * @returns True if user is a company admin
 */
export async function isCompanyAdmin(userId: string): Promise<boolean> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error } = await adminClient
      .from('users')
      .select('is_company_admin')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      logger.warn('[CompanyAdmin] User not found:', { userId, error });
      return false;
    }

    return userData.is_company_admin === true;
  } catch (error) {
    logger.error('[CompanyAdmin] Error checking company admin status:', error);
    return false;
  }
}

/**
 * Check if user is a company admin by auth ID
 * @param authId - Auth user ID from session
 * @returns True if user is a company admin
 */
export async function isCompanyAdminByAuthId(authId: string): Promise<boolean> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error } = await adminClient
      .from('users')
      .select('is_company_admin')
      .eq('auth_id', authId)
      .single();

    if (error || !userData) {
      logger.warn('[CompanyAdmin] User not found by auth_id:', { authId, error });
      return false;
    }

    return userData.is_company_admin === true;
  } catch (error) {
    logger.error('[CompanyAdmin] Error checking company admin status:', error);
    return false;
  }
}

