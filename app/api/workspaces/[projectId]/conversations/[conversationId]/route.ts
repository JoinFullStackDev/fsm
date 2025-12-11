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
import type { ConversationMessage } from '@/types/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/conversations/[conversationId]
 * Get full conversation with all messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; conversationId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, conversationId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(conversationId)) {
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

    // Get conversation
    const { data: conversation, error } = await adminClient
      .from('workspace_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('workspace_id', workspace.id)
      .single();

    if (error || !conversation) {
      return notFound('Conversation not found');
    }

    return NextResponse.json(conversation);
  } catch (error) {
    logger.error('[Conversations API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * PATCH /api/workspaces/[projectId]/conversations/[conversationId]
 * Update conversation (add message, archive, rename)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; conversationId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, conversationId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(conversationId)) {
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

    // Get existing conversation
    const { data: existingConv } = await adminClient
      .from('workspace_conversations')
      .select('messages, message_count')
      .eq('id', conversationId)
      .eq('workspace_id', workspace.id)
      .single();

    if (!existingConv) {
      return notFound('Conversation not found');
    }

    // Parse update data
    const body = await request.json();
    const updates: any = {};

    // Handle adding a message
    if (body.add_message) {
      const newMessage: ConversationMessage = body.add_message;
      const currentMessages = (existingConv.messages as ConversationMessage[]) || [];
      updates.messages = [...currentMessages, newMessage];
      updates.message_count = currentMessages.length + 1;
      updates.last_message_at = newMessage.timestamp;
    }

    // Handle replacing all messages (for action status updates)
    if (body.update_messages) {
      updates.messages = body.update_messages;
      updates.message_count = body.update_messages.length;
    }

    // Handle title update
    if (body.title) {
      updates.title = body.title;
    }

    // Handle archive
    if (body.is_archived !== undefined) {
      updates.is_archived = body.is_archived;
    }

    // Update conversation
    const { data: updatedConv, error } = await adminClient
      .from('workspace_conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();

    if (error || !updatedConv) {
      logger.error('[Conversations API] Failed to update conversation:', error);
      return internalError('Failed to update conversation');
    }

    return NextResponse.json(updatedConv);
  } catch (error) {
    logger.error('[Conversations API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

/**
 * DELETE /api/workspaces/[projectId]/conversations/[conversationId]
 * Archive conversation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; conversationId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in');
    }

    const { projectId, conversationId } = params;

    if (!isValidUUID(projectId) || !isValidUUID(conversationId)) {
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

    // Archive conversation
    const { error } = await adminClient
      .from('workspace_conversations')
      .update({ is_archived: true })
      .eq('id', conversationId)
      .eq('workspace_id', workspace.id);

    if (error) {
      logger.error('[Conversations API] Failed to archive conversation:', error);
      return internalError('Failed to archive conversation');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Conversations API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
