import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

/**
 * GET /api/projects/[id]/full
 * 
 * Fetches a complete project with all related data in a single request.
 * This endpoint parallelizes all data fetching for optimal performance.
 * 
 * Returns:
 * - project: Project data with owner and company info
 * - phases: Active project phases
 * - members: Project members with user details
 * - exportCount: Number of exports for this project
 * - templateFieldConfigs: Field configs grouped by phase number (if project has template)
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing project ID
 * @returns Combined project data, or error response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return badRequest('Invalid project ID format');
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view this project');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record using admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Projects Full API] User not found:', userError);
      return notFound('User not found');
    }

    // OPTIMIZATION: Fetch project first to validate access, then fetch all related data in parallel
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select(`
        *,
        company:companies(id, name),
        owner:users!projects_owner_id_fkey(id, name, email, avatar_url)
      `)
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      logger.error('[Projects Full API] Error fetching project:', { 
        projectId: params.id, 
        error: projectError 
      });
      return notFound('Project not found');
    }

    // Validate access: super admins can see all projects
    // For others, check if they're a project member OR project owner OR project belongs to their organization
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const projectInUserOrg = project.organization_id === organizationId;
    
    if (!isSuperAdmin && !isProjectOwner && !projectInUserOrg) {
      // Check if user is a project member
      const { data: projectMember } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .single();
      
      if (!projectMember) {
        return forbidden('You do not have access to this project');
      }
    }

    // OPTIMIZATION: Fetch all related data in parallel
    const [phasesResult, membersResult, exportsResult, templateConfigsResult] = await Promise.all([
      // Fetch phases
      adminClient
        .from('project_phases')
        .select('*')
        .eq('project_id', params.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      
      // Fetch members with user details and organization role
      adminClient
        .from('project_members')
        .select(`
          id,
          user_id,
          organization_role_id,
          created_at,
          organization_role:organization_roles (
            id,
            name,
            description
          ),
          user:users!project_members_user_id_fkey (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .eq('project_id', params.id)
        .order('created_at', { ascending: true }),
      
      // Fetch export count
      adminClient
        .from('project_exports')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', params.id),
      
      // Fetch template field configs if project has a template
      project.template_id
        ? adminClient
            .from('template_field_configs')
            .select('phase_number, field_key')
            .eq('template_id', project.template_id)
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Process results
    const { data: phases, error: phasesError } = phasesResult;
    const { data: members, error: membersError } = membersResult;
    const { count: exportCount, error: exportsError } = exportsResult;
    const { data: templateConfigs, error: templateConfigsError } = templateConfigsResult;

    // Log any errors but don't fail the entire request
    if (phasesError) {
      logger.error('[Projects Full API] Error fetching phases:', phasesError);
    }
    if (membersError) {
      logger.error('[Projects Full API] Error fetching members:', membersError);
    }
    if (exportsError) {
      logger.error('[Projects Full API] Error fetching exports:', exportsError);
    }
    if (templateConfigsError) {
      logger.error('[Projects Full API] Error fetching template configs:', templateConfigsError);
    }

    // Group template field configs by phase number for easier consumption
    const fieldConfigsByPhase: Record<number, Array<{ field_key: string }>> = {};
    if (templateConfigs) {
      templateConfigs.forEach((config: { phase_number: number; field_key: string }) => {
        if (!fieldConfigsByPhase[config.phase_number]) {
          fieldConfigsByPhase[config.phase_number] = [];
        }
        fieldConfigsByPhase[config.phase_number].push({ field_key: config.field_key });
      });
    }

    const response = NextResponse.json({
      project: {
        ...project,
        phases: undefined, // Remove nested phases from project, they're returned separately
      },
      phases: phases || [],
      members: members || [],
      exportCount: exportCount || 0,
      fieldConfigsByPhase,
      company: project.company || null,
    });
    
    // Add cache headers for browser caching
    response.headers.set('Cache-Control', 'private, max-age=10');
    return response;
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/full:', error);
    return internalError('Failed to load project data', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

