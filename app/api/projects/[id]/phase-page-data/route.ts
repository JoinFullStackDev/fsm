import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

/**
 * GET /api/projects/[id]/phase-page-data?phase_number=X
 * 
 * Combined endpoint that returns ALL data needed for a phase page in ONE call:
 * - Project details
 * - Current user info
 * - All phases (for navigation and dependencies)
 * - Current phase data
 * - Template field configs (if applicable)
 * 
 * This replaces 5+ separate API calls with a single optimized call.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in');
    }

    const searchParams = request.nextUrl.searchParams;
    const phaseNumber = parseInt(searchParams.get('phase_number') || '1', 10);

    if (isNaN(phaseNumber) || phaseNumber < 1) {
      return badRequest('Invalid phase number');
    }

    const adminClient = createAdminSupabaseClient();

    // OPTIMIZATION: Run ALL queries in parallel
    const [userResult, projectResult, phasesResult, currentPhaseResult] = await Promise.all([
      // 1. Get user record
      adminClient
        .from('users')
        .select('id, name, email, role, organization_id')
        .eq('auth_id', user.id)
        .single(),
      
      // 2. Get project with template info
      adminClient
        .from('projects')
        .select('id, name, description, status, template_id, owner_id, organization_id')
        .eq('id', params.id)
        .single(),
      
      // 3. Get all phases for this project
      adminClient
        .from('project_phases')
        .select('id, phase_number, phase_name, display_order, completed, is_active')
        .eq('project_id', params.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      
      // 4. Get current phase with data
      adminClient
        .from('project_phases')
        .select('*')
        .eq('project_id', params.id)
        .eq('phase_number', phaseNumber)
        .eq('is_active', true)
        .single(),
    ]);

    const { data: userData, error: userError } = userResult;
    const { data: project, error: projectError } = projectResult;
    const { data: phases, error: phasesError } = phasesResult;
    const { data: currentPhase, error: currentPhaseError } = currentPhaseResult;

    if (userError || !userData) {
      logger.error('[PhasePageData] User not found:', userError);
      return notFound('User not found');
    }

    if (projectError || !project) {
      logger.error('[PhasePageData] Project not found:', projectError);
      return notFound('Project not found');
    }

    if (currentPhaseError || !currentPhase) {
      logger.error('[PhasePageData] Phase not found:', currentPhaseError);
      return notFound('Phase not found');
    }

    // Check access
    const isOwner = project.owner_id === userData.id;
    const sameOrg = project.organization_id === userData.organization_id;
    
    if (!isOwner && !sameOrg) {
      // Check if user is a project member
      const { data: memberData } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .maybeSingle();

      if (!memberData) {
        return unauthorized('You do not have access to this project');
      }
    }

    // Get field configs if project has a template (separate query since it depends on template_id)
    let fieldConfigs: any[] = [];
    if (project.template_id) {
      const { data: configs, error: configsError } = await adminClient
        .from('template_field_configs')
        .select('*')
        .eq('template_id', project.template_id)
        .eq('phase_number', currentPhase.phase_number)
        .order('display_order', { ascending: true });
      
      if (configsError) {
        logger.warn('[PhasePageData] Error loading field configs:', configsError);
      }
      
      fieldConfigs = configs || [];
    }

    const responseTime = Date.now() - startTime;
    logger.debug('[PhasePageData] Combined data loaded in', responseTime, 'ms');

    // Return all data in one response
    const response = NextResponse.json({
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
      },
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        template_id: project.template_id,
        owner_id: project.owner_id,
      },
      phases: phases || [],
      currentPhase: {
        ...currentPhase,
        data: currentPhase.data || {},
      },
      fieldConfigs,
      meta: {
        responseTime,
        phaseCount: (phases || []).length,
        hasTemplate: !!project.template_id,
        fieldConfigCount: fieldConfigs.length,
      },
    });

    // Short cache for performance
    response.headers.set('Cache-Control', 'private, max-age=5');
    return response;
  } catch (error) {
    logger.error('[PhasePageData] Error:', error);
    return internalError('Failed to load phase data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

