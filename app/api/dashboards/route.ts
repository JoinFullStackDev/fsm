import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboards
 * List all dashboards accessible to the user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view dashboards');
    }

    // Get user record
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', authUser.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User record not found');
      }
      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    const organizationId = userData.organization_id;
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check module access
    const hasAccess = await hasCustomDashboards(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'personal', 'organization', 'project', or null for all
    const projectId = searchParams.get('project_id');

    // Build query
    let query = supabase
      .from('dashboards')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by type
    if (type === 'personal') {
      query = query.eq('is_personal', true).eq('owner_id', userData.id);
    } else if (type === 'organization') {
      query = query.eq('is_personal', false).eq('organization_id', organizationId).is('project_id', null);
    } else if (type === 'project') {
      if (projectId) {
        query = query.eq('is_personal', false).eq('project_id', projectId);
      } else {
        // Get all projects user has access to
        const { data: userProjects } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', userData.id);

        const projectIds = userProjects?.map(p => p.project_id) || [];
        if (projectIds.length > 0) {
          query = query.eq('is_personal', false).in('project_id', projectIds);
        } else {
          query = query.eq('is_personal', false).eq('project_id', '00000000-0000-0000-0000-000000000000'); // No results
        }
      }
    } else {
      // All dashboards user has access to
      // Personal dashboards
      const personalQuery = supabase
        .from('dashboards')
        .select('*')
        .eq('is_personal', true)
        .eq('owner_id', userData.id);

      // Organization dashboards
      const orgQuery = supabase
        .from('dashboards')
        .select('*')
        .eq('is_personal', false)
        .eq('organization_id', organizationId)
        .is('project_id', null);

      // Project dashboards
      const { data: userProjects } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userData.id);

      const projectIds = userProjects?.map(p => p.project_id) || [];
      let projectQuery = supabase
        .from('dashboards')
        .select('*')
        .eq('is_personal', false);

      if (projectIds.length > 0) {
        projectQuery = projectQuery.in('project_id', projectIds);
      } else {
        projectQuery = projectQuery.eq('project_id', '00000000-0000-0000-0000-000000000000'); // No results
      }

      // Execute all queries and combine
      const [personalResult, orgResult, projectResult] = await Promise.all([
        personalQuery,
        orgQuery,
        projectQuery,
      ]);

      const allDashboards = [
        ...(personalResult.data || []),
        ...(orgResult.data || []),
        ...(projectResult.data || []),
      ];

      // Remove duplicates and sort
      const uniqueDashboards = Array.from(
        new Map(allDashboards.map(d => [d.id, d])).values()
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return NextResponse.json({ dashboards: uniqueDashboards });
    }

    const { data: dashboards, error } = await query;

    if (error) {
      logger.error('[Dashboards API] Error fetching dashboards:', error);
      return internalError('Failed to fetch dashboards');
    }

    return NextResponse.json({ dashboards: dashboards || [] });
  } catch (error) {
    logger.error('[Dashboards API] Error in GET:', error);
    return internalError('Failed to load dashboards', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/dashboards
 * Create a new dashboard
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to create dashboards');
    }

    // Get user record
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', authUser.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User record not found');
      }
      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    const organizationId = userData.organization_id;
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check module access
    const hasAccess = await hasCustomDashboards(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    const body = await request.json();
    const { name, description, is_personal, organization_id, project_id, is_default, layout } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Dashboard name is required');
    }

    // Validate dashboard type
    if (is_personal === true) {
      // Personal dashboard: no org or project
      if (organization_id || project_id) {
        return badRequest('Personal dashboards cannot have organization_id or project_id');
      }
    } else {
      // Organization or project dashboard
      if (organization_id && project_id) {
        return badRequest('Dashboard cannot have both organization_id and project_id');
      }
      if (!organization_id && !project_id) {
        return badRequest('Organization or project dashboard must have organization_id or project_id');
      }

      // Validate organization access
      if (organization_id && organization_id !== organizationId) {
        return forbidden('You can only create dashboards for your own organization');
      }

      // Validate project access
      if (project_id) {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('id, owner_id, organization_id')
          .eq('id', project_id)
          .single();

        if (projectError || !project) {
          return notFound('Project not found');
        }

        // Check if user is project owner or member
        const { data: member } = await supabase
          .from('project_members')
          .select('id')
          .eq('project_id', project_id)
          .eq('user_id', userData.id)
          .single();

        if (project.owner_id !== userData.id && !member) {
          return forbidden('You do not have access to this project');
        }
      }

      // Check permissions for organization dashboards
      if (organization_id && userData.role !== 'admin' && userData.role !== 'pm') {
        return forbidden('Only admins and PMs can create organization dashboards');
      }
    }

    // If setting as default, unset other defaults in the same scope
    if (is_default === true) {
      let unsetQuery = supabase
        .from('dashboards')
        .update({ is_default: false })
        .eq('is_default', true);

      if (is_personal) {
        unsetQuery = unsetQuery.eq('owner_id', userData.id).eq('is_personal', true);
      } else if (organization_id) {
        unsetQuery = unsetQuery.eq('organization_id', organization_id).eq('is_personal', false).is('project_id', null);
      } else if (project_id) {
        unsetQuery = unsetQuery.eq('project_id', project_id).eq('is_personal', false);
      }

      await unsetQuery;
    }

    // Create dashboard
    const insertData: any = {
      owner_id: userData.id,
      name: name.trim(),
      description: description?.trim() || null,
      is_personal: is_personal === true,
      is_default: is_default === true || false,
      layout: layout || {},
    };

    if (organization_id) {
      insertData.organization_id = organization_id;
    }
    if (project_id) {
      insertData.project_id = project_id;
    }

    const { data: dashboard, error: insertError } = await supabase
      .from('dashboards')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      logger.error('[Dashboards API] Error creating dashboard:', insertError);
      return internalError('Failed to create dashboard');
    }

    return NextResponse.json({ dashboard }, { status: 201 });
  } catch (error) {
    logger.error('[Dashboards API] Error in POST:', error);
    return internalError('Failed to create dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

