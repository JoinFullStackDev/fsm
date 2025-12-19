import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { generateAIResponse } from '@/lib/ai/geminiClient';
import { unauthorized, badRequest, internalError, forbidden, notFound } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { Stakeholder, UpdateType } from '@/types/workspace-extended';

const adminClient = createAdminSupabaseClient();

interface DraftAIRequestBody {
  update_type: UpdateType;
  stakeholder_ids: string[];
  linked_clarity_spec_id?: string;
  linked_epic_draft_id?: string;
  linked_roadmap_item_id?: string;
  key_points?: string[];
  tone?: 'formal' | 'casual' | 'technical';
}

// POST /api/workspaces/[projectId]/stakeholders/updates/draft-ai - AI-powered update drafting
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

    // Fetch workspace
    const { data: workspace } = await adminClient
      .from('project_workspaces')
      .select('id')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .single();

    if (!workspace) {
      return notFound('Workspace not found');
    }

    const body: DraftAIRequestBody = await request.json();

    // Validate required fields
    if (!body.update_type || !body.stakeholder_ids || body.stakeholder_ids.length === 0) {
      return badRequest('Update type and stakeholder IDs are required');
    }

    // Fetch stakeholder information
    const { data: stakeholders, error: stakeholdersError } = await adminClient
      .from('workspace_stakeholders')
      .select('*')
      .in('id', body.stakeholder_ids)
      .eq('workspace_id', workspace.id);

    if (stakeholdersError) {
      logger.error('[AI Draft API] Error fetching stakeholders:', stakeholdersError);
      return internalError('Failed to fetch stakeholder information');
    }

    // Fetch linked content if provided
    let linkedContent: any = {};

    if (body.linked_clarity_spec_id) {
      const { data: claritySpec } = await adminClient
        .from('workspace_clarity_specs')
        .select('*')
        .eq('id', body.linked_clarity_spec_id)
        .single();
      linkedContent.claritySpec = claritySpec;
    }

    if (body.linked_epic_draft_id) {
      const { data: epicDraft } = await adminClient
        .from('workspace_epic_drafts')
        .select('*')
        .eq('id', body.linked_epic_draft_id)
        .single();
      linkedContent.epicDraft = epicDraft;
    }

    if (body.linked_roadmap_item_id) {
      const { data: roadmapItem } = await adminClient
        .from('workspace_roadmap_items')
        .select('*')
        .eq('id', body.linked_roadmap_item_id)
        .single();
      linkedContent.roadmapItem = roadmapItem;
    }

    // Build AI prompt
    const stakeholderProfiles = (stakeholders as Stakeholder[])
      .map(s => `- ${s.name} (${s.role || 'Role not specified'}): ${s.alignment_status} alignment, concerns: ${s.key_concerns.join(', ') || 'none listed'}, interests: ${s.key_interests.join(', ') || 'none listed'}`)
      .join('\n');

    const systemPrompt = 'You are an expert product manager and communicator. You create clear, compelling stakeholder updates that address concerns, highlight progress, and maintain alignment.';
    const userPrompt = buildDraftPrompt(body.update_type, stakeholderProfiles, linkedContent, body.key_points, body.tone);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // Generate draft using AI
    const aiResponse = await generateAIResponse(fullPrompt, {}, process.env.GEMINI_API_KEY || '');

    const draftContent = typeof aiResponse === 'string' ? aiResponse : aiResponse.text;

    // Parse the draft into title, summary, and full_content
    const lines = draftContent.split('\n');
    const title = lines[0].replace(/^#+\s*/, '').trim();
    const summaryStartIndex = lines.findIndex(l => l.toLowerCase().includes('summary:')) + 1;
    const contentStartIndex = lines.findIndex(l => l.toLowerCase().includes('full update:')) + 1;

    const summary = summaryStartIndex > 0 && contentStartIndex > summaryStartIndex
      ? lines.slice(summaryStartIndex, contentStartIndex - 1).join('\n').trim()
      : '';

    const full_content = contentStartIndex > 0
      ? lines.slice(contentStartIndex).join('\n').trim()
      : draftContent;

    return NextResponse.json({
      draft: {
        title,
        summary,
        full_content,
        update_type: body.update_type,
        stakeholder_ids: body.stakeholder_ids,
        linked_clarity_spec_id: body.linked_clarity_spec_id,
        linked_epic_draft_id: body.linked_epic_draft_id,
        linked_roadmap_item_id: body.linked_roadmap_item_id,
      }
    });
  } catch (error) {
    logger.error('[AI Draft API] Unexpected error in POST:', error);
    return internalError('An unexpected error occurred');
  }
}

function buildDraftPrompt(
  updateType: UpdateType,
  stakeholderProfiles: string,
  linkedContent: any,
  keyPoints?: string[],
  tone: 'formal' | 'casual' | 'technical' = 'formal'
): string {
  let prompt = `Create a stakeholder update of type "${updateType}" with a ${tone} tone.\n\n`;

  prompt += `**Target Stakeholders:**\n${stakeholderProfiles}\n\n`;

  if (linkedContent.claritySpec) {
    prompt += `**Related Clarity Canvas Spec:**\n`;
    prompt += `- Problem: ${linkedContent.claritySpec.problem_statement}\n`;
    prompt += `- Solution: ${linkedContent.claritySpec.solution_hypothesis}\n`;
    prompt += `- Success Criteria: ${linkedContent.claritySpec.success_criteria?.join(', ')}\n\n`;
  }

  if (linkedContent.epicDraft) {
    prompt += `**Related Epic:**\n`;
    prompt += `- Title: ${linkedContent.epicDraft.title}\n`;
    prompt += `- Description: ${linkedContent.epicDraft.description}\n\n`;
  }

  if (linkedContent.roadmapItem) {
    prompt += `**Related Roadmap Item:**\n`;
    prompt += `- Feature: ${linkedContent.roadmapItem.feature_name}\n`;
    prompt += `- Status: ${linkedContent.roadmapItem.status}\n`;
    prompt += `- Priority: ${linkedContent.roadmapItem.priority_bucket}\n\n`;
  }

  if (keyPoints && keyPoints.length > 0) {
    prompt += `**Key Points to Include:**\n${keyPoints.map(p => `- ${p}`).join('\n')}\n\n`;
  }

  prompt += `Please generate:\n`;
  prompt += `1. A clear, compelling title\n`;
  prompt += `2. Summary: A 2-3 sentence executive summary\n`;
  prompt += `3. Full Update: A comprehensive update that:\n`;
  prompt += `   - Addresses stakeholder concerns and interests\n`;
  prompt += `   - Highlights progress and key decisions\n`;
  prompt += `   - Provides clear next steps\n`;
  prompt += `   - Maintains appropriate tone (${tone})\n`;
  prompt += `   - Uses bullet points and clear structure\n`;

  return prompt;
}

