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
import type { CreateEpicDraftInput } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/epics
 * List all epic drafts for a workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId } = params;

    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID');
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

    // Get all epic drafts
    const { data: epics, error } = await adminClient
      .from('epic_drafts')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[Epic API] Failed to fetch epics:', error);
      return internalError('Failed to fetch epic drafts');
    }

    return NextResponse.json(epics || []);
  } catch (error) {
    logger.error('[Epic API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/workspaces/[projectId]/epics
 * Create new epic draft
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId } = params;

    if (!isValidUUID(projectId)) {
      return badRequest('Invalid project ID');
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

    // Get user record
    const { data: user } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return notFound('User record not found');
    }

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

    // Parse request body
    const body = await request.json();
    const input: CreateEpicDraftInput = body;

    if (!input.title) {
      return badRequest('Title is required');
    }

    // Validate clarity_spec_id if provided
    if (input.clarity_spec_id && !isValidUUID(input.clarity_spec_id)) {
      return badRequest('Invalid clarity spec ID');
    }

    // Create epic draft
    const { data: epic, error } = await adminClient
      .from('epic_drafts')
      .insert({
        workspace_id: workspace.id,
        clarity_spec_id: input.clarity_spec_id || null,
        title: input.title,
        description: input.description || null,
        frontend_issues: input.frontend_issues || [],
        backend_issues: input.backend_issues || [],
        design_issues: input.design_issues || [],
        definition_of_done: input.definition_of_done || [],
        value_tags: input.value_tags || [],
        risk_level: input.risk_level || 'medium',
        effort_estimate: input.effort_estimate || null,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !epic) {
      logger.error('[Epic API] Failed to create epic:', error);
      return internalError('Failed to create epic draft');
    }

    logger.info('[Epic API] Created epic draft:', {
      epicId: epic.id,
      workspaceId: workspace.id,
      title: epic.title,
    });

    return NextResponse.json(epic);
  } catch (error) {
    logger.error('[Epic API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
