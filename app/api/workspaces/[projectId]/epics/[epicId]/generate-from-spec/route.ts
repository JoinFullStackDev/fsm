import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { 
  unauthorized, 
  notFound, 
  badRequest, 
  forbidden, 
  internalError 
} from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import { generateEpicFromClarity } from '@/lib/ai/epicGenerator';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspaces/[projectId]/epics/[epicId]/generate-from-spec
 * Generate epic content from clarity spec using AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; epicId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, epicId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(epicId)) {
      return badRequest('Invalid ID format');
    }

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User not assigned to organization');
    }

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) {
      return forbidden('Product Workspace module not enabled');
    }

    const adminClient = createAdminSupabaseClient();

    // Get workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    // Get epic
    const { data: epic } = await adminClient
      .from('epic_drafts')
      .select('*')
      .eq('id', epicId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!epic) {
      return notFound('Epic draft not found');
    }

    // Get clarity spec (use epic's linked spec or active workspace spec)
    let claritySpecId = epic.clarity_spec_id;
    
    if (!claritySpecId) {
      // Use active clarity spec from workspace
      const { data: activeWorkspace } = await adminClient
        .from('project_workspaces')
        .select('active_clarity_spec_id')
        .eq('id', workspace.id)
        .single();

      claritySpecId = activeWorkspace?.active_clarity_spec_id || null;
    }

    if (!claritySpecId) {
      return badRequest('No clarity spec linked to epic and no active spec in workspace');
    }

    // Get clarity spec
    const { data: spec } = await adminClient
      .from('clarity_specs')
      .select('*')
      .eq('id', claritySpecId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!spec) {
      return notFound('Clarity spec not found');
    }

    // Get Gemini API key (prioritizes environment variable)
    const { getGeminiApiKey } = await import('@/lib/utils/geminiConfig');
    const apiKey = await getGeminiApiKey(supabase);

    if (!apiKey) {
      return badRequest('Gemini API key not configured. Please configure GOOGLE_GENAI_API_KEY environment variable or contact your administrator.');
    }

    // Generate epic content using AI
    const generated = await generateEpicFromClarity(spec, apiKey);

    // Update epic with generated content
    const { data: updatedEpic, error } = await adminClient
      .from('epic_drafts')
      .update({
        title: generated.title,
        description: generated.description,
        frontend_issues: generated.frontend_issues,
        backend_issues: generated.backend_issues,
        design_issues: generated.design_issues || [],
        definition_of_done: generated.definition_of_done,
        value_tags: generated.value_tags,
        risk_level: generated.risk_level,
        effort_estimate: generated.effort_estimate,
        clarity_spec_id: claritySpecId,
      })
      .eq('id', epicId)
      .select()
      .single();

    if (error || !updatedEpic) {
      logger.error('[Epic Generate API] Failed to update epic:', error);
      return internalError('Failed to save generated epic');
    }

    logger.info('[Epic Generate API] Generated epic from clarity spec:', {
      epicId,
      claritySpecId,
      title: generated.title,
    });

    return NextResponse.json(updatedEpic);
  } catch (error) {
    logger.error('[Epic Generate API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
