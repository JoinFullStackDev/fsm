import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { CreateFeedbackInput } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId } = params;
    if (!isValidUUID(projectId)) return badRequest('Invalid project ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const { searchParams } = new URL(request.url);
    const feedbackType = searchParams.get('feedback_type');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    let query = adminClient.from('workspace_feedback').select('*').eq('workspace_id', workspace.id).order('feedback_date', { ascending: false });
    if (feedbackType) query = query.eq('feedback_type', feedbackType);
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    const { data: feedback, error } = await query;
    if (error) {
      logger.error('[Discovery API] Failed to fetch feedback:', error);
      return internalError('Failed to fetch feedback');
    }

    return NextResponse.json(feedback || []);
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return unauthorized('You must be logged in');

    const { projectId } = params;
    if (!isValidUUID(projectId)) return badRequest('Invalid project ID');

    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) return badRequest('User not assigned to organization');

    const orgContext = await getOrganizationContextById(supabase, organizationId);
    if (!orgContext?.package?.features?.product_workspace_enabled) return forbidden('Product Workspace module not enabled');

    const { data: userRecord } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single();
    const adminClient = createAdminSupabaseClient();
    const { data: workspace } = await adminClient.from('project_workspaces').select('id').eq('project_id', projectId).eq('organization_id', organizationId).single();
    if (!workspace) return notFound('Workspace not found');

    const body = await request.json() as CreateFeedbackInput;
    if (!body.title || !body.content || !body.feedback_type) return badRequest('Title, content, and type are required');

    const { data: feedback, error } = await adminClient.from('workspace_feedback').insert({
      workspace_id: workspace.id,
      title: body.title,
      content: body.content,
      feedback_type: body.feedback_type,
      priority: body.priority || 'medium',
      category: body.category || [],
      affected_feature: body.affected_feature || null,
      source: body.source || null,
      source_url: body.source_url || null,
      submitted_by_email: body.submitted_by_email || null,
      submitted_by_name: body.submitted_by_name || null,
      feedback_date: body.feedback_date || new Date().toISOString().split('T')[0],
      created_by: userRecord?.id || null,
    }).select().single();

    if (error) {
      logger.error('[Discovery API] Failed to create feedback:', error);
      return internalError('Failed to create feedback');
    }

    logger.info('[Discovery API] Feedback created:', { feedbackId: feedback.id });
    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

