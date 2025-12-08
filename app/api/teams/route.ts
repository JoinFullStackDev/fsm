import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { TeamWithMembers } from '@/types/project';

// Type for team with team_members from query
interface TeamQueryResult {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  team_members?: Array<{
    id: string;
    user_id: string;
    created_at: string;
    user?: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/teams
 * List all teams for the user's organization
 */
export async function GET() {
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

    // Fetch teams with member counts (with short caching for performance)
    const { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache/unifiedCache');
    const teamsCacheKey = `teams:org:${userData.organization_id}`;
    
    const teamsWithCounts = await cacheGetOrSet(
      teamsCacheKey,
      async () => {
        const { data: teams, error: teamsError } = await supabase
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
          .eq('organization_id', userData.organization_id)
          .order('name');

        if (teamsError) {
          logger.error('[Teams API] Error fetching teams:', teamsError);
          throw new Error('Failed to fetch teams');
        }

        // Transform to include member_count
        const typedTeams = (teams || []) as TeamQueryResult[];
        return typedTeams.map(team => ({
          ...team,
          members: team.team_members || [],
          member_count: team.team_members?.length || 0,
        })) as TeamWithMembers[];
      },
      30 // 30 second cache
    );

    const response = NextResponse.json({ teams: teamsWithCounts });
    response.headers.set('Cache-Control', 'private, max-age=10, must-revalidate');
    return response;
  } catch (error) {
    logger.error('[Teams API] GET error:', error);
    return internalError('Failed to fetch teams');
  }
}

/**
 * POST /api/teams
 * Create a new team (company admin only)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description, color } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Team name is required');
    }

    // Create team
    const { data: team, error: createError } = await supabase
      .from('teams')
      .insert({
        organization_id: userData.organization_id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6366f1',
      })
      .select()
      .single();

    if (createError) {
      if (createError.code === '23505') {
        return badRequest('A team with this name already exists');
      }
      logger.error('[Teams API] Error creating team:', createError);
      return internalError('Failed to create team');
    }

    logger.info('[Teams API] Team created:', { teamId: team.id, name: team.name });

    // Invalidate teams cache
    try {
      const { cacheDel } = await import('@/lib/cache/unifiedCache');
      await cacheDel(`teams:org:${userData.organization_id}`);
    } catch (cacheError) {
      logger.warn('[Teams API] Failed to invalidate cache:', cacheError);
    }

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    logger.error('[Teams API] POST error:', error);
    return internalError('Failed to create team');
  }
}

