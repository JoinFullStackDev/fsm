import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest, conflict } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { convertOpportunityToProject } from '@/lib/ops/opportunityConversion';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to convert opportunities');
    }

    const { id: opportunityId } = params;

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Get opportunity
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single();

    if (opportunityError || !opportunity) {
      if (opportunityError?.code === 'PGRST116') {
        return notFound('Opportunity not found');
      }
      logger.error('Error loading opportunity:', opportunityError);
      return internalError('Failed to load opportunity', { error: opportunityError?.message });
    }

    // Check if opportunity is already converted
    if (opportunity.status === 'converted') {
      // Check if project already exists
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id')
        .eq('opportunity_id', opportunityId)
        .single();

      if (existingProject) {
        return conflict('This opportunity has already been converted to a project');
      }
    }

    // Get request body for template_id and member_ids
    const body = await request.json().catch(() => ({}));
    const { template_id, member_ids } = body;

    // Convert opportunity to project
    const project = await convertOpportunityToProject(
      supabase,
      opportunity,
      userData.id,
      template_id || null,
      member_ids || []
    );

    // Update opportunity status to 'converted'
    await supabase
      .from('opportunities')
      .update({ status: 'converted' })
      .eq('id', opportunityId);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/opportunities/[id]/convert:', error);
    return internalError('Failed to convert opportunity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

