import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { TeamWithMembers } from '@/types/project';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teams/[id]
 * Get a specific team with members
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

    // Fetch team with members
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select(`
        *,
        team_members (
          id,
          user_id,
          created_at,
          user:users (
            id,
            name,
            email
          )
        )
      `)
      .eq('id', params.id)
      .eq('organization_id', userData.organization_id)
      .single();

    if (teamError || !team) {
      return notFound('Team not found');
    }

    const teamWithMembers: TeamWithMembers = {
      ...team,
      members: team.team_members || [],
      member_count: team.team_members?.length || 0,
    };

    return NextResponse.json({ team: teamWithMembers });
  } catch (error) {
    logger.error('[Teams API] GET [id] error:', error);
    return internalError('Failed to fetch team');
  }
}

/**
 * PUT /api/teams/[id]
 * Update a team (company admin only)
 */
export async function PUT(
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
    const { data: existingTeam, error: checkError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', params.id)
      .eq('organization_id', userData.organization_id)
      .single();

    if (checkError || !existingTeam) {
      return notFound('Team not found');
    }

    const body = await request.json();
    const { name, description, color } = body;

    const updates: { name?: string; description?: string | null; color?: string } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return badRequest('Team name cannot be empty');
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (color !== undefined) {
      updates.color = color;
    }

    // Update team
    const { data: team, error: updateError } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        return badRequest('A team with this name already exists');
      }
      logger.error('[Teams API] Error updating team:', updateError);
      return internalError('Failed to update team');
    }

    logger.info('[Teams API] Team updated:', { teamId: team.id, updates });

    // Invalidate teams cache
    try {
      const { cacheDel } = await import('@/lib/cache/unifiedCache');
      await cacheDel(`teams:org:${userData.organization_id}`);
    } catch (cacheError) {
      logger.warn('[Teams API] Failed to invalidate cache:', cacheError);
    }

    return NextResponse.json({ team });
  } catch (error) {
    logger.error('[Teams API] PUT error:', error);
    return internalError('Failed to update team');
  }
}

/**
 * DELETE /api/teams/[id]
 * Delete a team (company admin only)
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
    const { data: existingTeam, error: checkError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', params.id)
      .eq('organization_id', userData.organization_id)
      .single();

    if (checkError || !existingTeam) {
      return notFound('Team not found');
    }

    // Delete team (cascade will remove team_members)
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      logger.error('[Teams API] Error deleting team:', deleteError);
      return internalError('Failed to delete team');
    }

    logger.info('[Teams API] Team deleted:', { teamId: params.id, name: existingTeam.name });

    // Invalidate teams cache
    try {
      const { cacheDel } = await import('@/lib/cache/unifiedCache');
      await cacheDel(`teams:org:${userData.organization_id}`);
    } catch (cacheError) {
      logger.warn('[Teams API] Failed to invalidate cache:', cacheError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Teams API] DELETE error:', error);
    return internalError('Failed to delete team');
  }
}

