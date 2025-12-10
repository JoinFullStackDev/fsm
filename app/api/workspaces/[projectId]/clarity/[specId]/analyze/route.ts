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
import { analyzeClaritySpec } from '@/lib/ai/clarityAnalyzer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspaces/[projectId]/clarity/[specId]/analyze
 * AI re-analysis of clarity spec
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; specId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, specId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(specId)) {
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

    // Get spec
    const { data: spec, error: specError } = await adminClient
      .from('clarity_specs')
      .select('*')
      .eq('id', specId)
      .eq('workspace_id', workspace.id)
      .single();

    if (specError || !spec) {
      return notFound('Clarity spec not found');
    }

    // Get Gemini API key
    const { getGeminiApiKey } = await import('@/lib/utils/geminiConfig');
    const apiKey = await getGeminiApiKey(supabase);

    // Run AI analysis (works without API key but better with it)
    const analysis = await analyzeClaritySpec(spec, apiKey || undefined);

    // Update spec with analysis results
    const { data: updatedSpec, error: updateError } = await adminClient
      .from('clarity_specs')
      .update({
        ai_readiness_score: analysis.readiness_score,
        ai_risk_warnings: analysis.risk_warnings,
        ai_suggestions: analysis.suggestions,
        ai_last_analyzed_at: new Date().toISOString(),
      })
      .eq('id', specId)
      .select()
      .single();

    if (updateError || !updatedSpec) {
      logger.error('[Clarity Analyze API] Failed to update spec:', updateError);
      return internalError('Failed to save analysis results');
    }

    logger.info('[Clarity Analyze API] Analysis complete:', {
      specId,
      readinessScore: analysis.readiness_score,
    });

    return NextResponse.json({
      spec: updatedSpec,
      analysis,
    });
  } catch (error) {
    logger.error('[Clarity Analyze API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
