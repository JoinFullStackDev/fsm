import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, forbidden, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/packages
 * Get all packages (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in');
    }

    // Check if user is super admin
    const { data: userData, error: dbUserError } = await supabase
      .from('users')
      .select('role, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (dbUserError || !userData) {
      return unauthorized('User not found');
    }

    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      return forbidden('Super admin access required');
    }

    const adminClient = createAdminSupabaseClient();

    const { data: packages, error: packagesError } = await adminClient
      .from('packages')
      .select('*')
      .order('display_order', { ascending: true });

    if (packagesError) {
      logger.error('Error loading packages:', packagesError);
      return internalError('Failed to load packages', { error: packagesError.message });
    }

    return NextResponse.json({ packages: packages || [] });
  } catch (error) {
    logger.error('Error in GET /api/admin/packages:', error);
    return internalError('Failed to load packages', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

