import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import {
  unauthorized,
  notFound,
  badRequest,
  forbidden,
  internalError,
} from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/conversations
 * List all conversation threads
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

    // Get all non-archived conversations
    const { data: conversations, error } = await adminClient
      .from('workspace_conversations')
      .select('id, title, message_count, last_message_at, created_at')
      .eq('workspace_id', workspace.id)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      logger.error('[Conversations API] Failed to fetch conversations:', error);
      return internalError('Failed to fetch conversations');
    }

    return NextResponse.json(conversations || []);
  } catch (error) {
    logger.error('[Conversations API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/workspaces/[projectId]/conversations
 * Create new conversation thread
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

    // Parse optional title from request
    const body = await request.json();
    const title = body.title || 'New Conversation';

    // Create conversation
    const { data: conversation, error } = await adminClient
      .from('workspace_conversations')
      .insert({
        workspace_id: workspace.id,
        title,
        messages: [],
        message_count: 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !conversation) {
      logger.error('[Conversations API] Failed to create conversation:', error);
      return internalError('Failed to create conversation');
    }

    logger.info('[Conversations API] Created conversation:', {
      conversationId: conversation.id,
      workspaceId: workspace.id,
    });

    return NextResponse.json(conversation);
  } catch (error) {
    logger.error('[Conversations API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
