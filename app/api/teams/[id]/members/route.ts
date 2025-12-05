import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teams/[id]/members
 * List members of a team
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    // Get user's organization
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData?.organization_id) {
      return unauthorized('User not found or no organization');
    }

    // Verify team exists and belongs to org
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', params.id)
      .eq('organization_id', userData.organization_id)
      .single();

    if (teamError || !team) {
      return notFound('Team not found');
    }

    // Fetch team members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        created_at,
        user:users (
          id,
          name,
          email
        )
      `)
      .eq('team_id', params.id)
      .order('created_at');

    if (membersError) {
      logger.error('[Teams Members API] Error fetching members:', membersError);
      return internalError('Failed to fetch team members');
    }

    return NextResponse.json({ members: members || [] });
  } catch (error) {
    logger.error('[Teams Members API] GET error:', error);
    return internalError('Failed to fetch team members');
  }
}

/**
 * POST /api/teams/[id]/members
 * Add a member to a team (company admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    // Get user and verify company admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, organization_id, is_company_admin, is_super_admin, role')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData?.organization_id) {
      return unauthorized('User not found or no organization');
    }

    // Check company admin access
    const isCompanyAdmin = userData.is_company_admin === true;
    const isSuperAdmin = userData.is_super_admin === true;
    const isLegacyAdmin = userData.role === 'admin' && !userData.is_super_admin;

    if (!isCompanyAdmin && !isSuperAdmin && !isLegacyAdmin) {
      return forbidden('Company admin access required');
    }

    // Verify team exists and belongs to org
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', params.id)
      .eq('organization_id', userData.organization_id)
      .single();

    if (teamError || !team) {
      return notFound('Team not found');
    }

    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return badRequest('User ID is required');
    }

    // Verify user exists and belongs to same org
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', user_id)
      .eq('organization_id', userData.organization_id)
      .single();

    if (targetError || !targetUser) {
      return notFound('User not found in organization');
    }

    // Add member to team
    const { data: member, error: addError } = await supabase
      .from('team_members')
      .insert({
        team_id: params.id,
        user_id,
      })
      .select(`
        id,
        user_id,
        created_at,
        user:users (
          id,
          name,
          email
        )
      `)
      .single();

    if (addError) {
      if (addError.code === '23505') {
        return badRequest('User is already a member of this team');
      }
      logger.error('[Teams Members API] Error adding member:', addError);
      return internalError('Failed to add team member');
    }

    logger.info('[Teams Members API] Member added:', {
      teamId: params.id,
      teamName: team.name,
      userId: user_id,
      userName: targetUser.name,
    });

    // Invalidate teams cache
    try {
      const { cacheDel } = await import('@/lib/cache/unifiedCache');
      await cacheDel(`teams:org:${userData.organization_id}`);
    } catch (cacheError) {
      logger.warn('[Teams Members API] Failed to invalidate cache:', cacheError);
    }

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    logger.error('[Teams Members API] POST error:', error);
    return internalError('Failed to add team member');
  }
}

/**
 * DELETE /api/teams/[id]/members
 * Remove a member from a team (company admin only)
 * Query param: ?user_id=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    // Get user and verify company admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, organization_id, is_company_admin, is_super_admin, role')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData?.organization_id) {
      return unauthorized('User not found or no organization');
    }

    // Check company admin access
    const isCompanyAdmin = userData.is_company_admin === true;
    const isSuperAdmin = userData.is_super_admin === true;
    const isLegacyAdmin = userData.role === 'admin' && !userData.is_super_admin;

    if (!isCompanyAdmin && !isSuperAdmin && !isLegacyAdmin) {
      return forbidden('Company admin access required');
    }

    // Verify team exists and belongs to org
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', params.id)
      .eq('organization_id', userData.organization_id)
      .single();

    if (teamError || !team) {
      return notFound('Team not found');
    }

    // Get user_id from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return badRequest('User ID is required');
    }

    // Delete team member
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', params.id)
      .eq('user_id', userId);

    if (deleteError) {
      logger.error('[Teams Members API] Error removing member:', deleteError);
      return internalError('Failed to remove team member');
    }

    logger.info('[Teams Members API] Member removed:', {
      teamId: params.id,
      teamName: team.name,
      userId,
    });

    // Invalidate teams cache
    try {
      const { cacheDel } = await import('@/lib/cache/unifiedCache');
      await cacheDel(`teams:org:${userData.organization_id}`);
    } catch (cacheError) {
      logger.warn('[Teams Members API] Failed to invalidate cache:', cacheError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Teams Members API] DELETE error:', error);
    return internalError('Failed to remove team member');
  }
}

