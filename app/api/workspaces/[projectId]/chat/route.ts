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
import { buildWorkspaceContext, formatContextForAI } from '@/lib/workspace/contextBuilder';
import { streamGeminiResponse, buildSystemPrompt } from '@/lib/ai/streamingClient';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workspaces/[projectId]/chat
 * Stream AI responses with full project context
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

    // Get user record
    const { data: user } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return notFound('User record not found');
    }

    // Parse request body
    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message || typeof message !== 'string') {
      return badRequest('Message is required');
    }

    if (message.length > 10000) {
      return badRequest('Message too long (max 10,000 characters)');
    }

    // Get API key
    const apiKey = await getGeminiApiKey(supabase);
    if (!apiKey) {
      return badRequest('Gemini API key not configured');
    }

    // Build full context
    const contextData = await buildWorkspaceContext(projectId, workspace.id, adminClient);
    const contextText = formatContextForAI(contextData);

    // Load conversation history if provided
    let conversationHistory = '';
    let conversationRecord = null;

    if (conversation_id && isValidUUID(conversation_id)) {
      const { data: conv } = await adminClient
        .from('workspace_conversations')
        .select('*')
        .eq('id', conversation_id)
        .eq('workspace_id', workspace.id)
        .single();

      if (conv) {
        conversationRecord = conv;
        const messages = (conv.messages as any[]) || [];
        // Include last 5 messages for context
        const recentMessages = messages.slice(-5);
        conversationHistory = recentMessages
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n');
      }
    }

    // Build full prompt
    const systemPrompt = buildSystemPrompt(contextText, conversationHistory);
    const fullPrompt = `${systemPrompt}\n\n**USER QUESTION:**\n${message}`;

    logger.info('[Chat API] Starting stream:', {
      projectId,
      workspaceId: workspace.id,
      conversationId: conversation_id,
      messageLength: message.length,
      hasHistory: !!conversationHistory,
    });

    // Stream response
    const stream = await streamGeminiResponse(fullPrompt, apiKey);

    // Return streaming response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': conversation_id || 'new',
      },
    });
  } catch (error) {
    logger.error('[Chat API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}
