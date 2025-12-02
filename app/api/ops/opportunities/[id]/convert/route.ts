import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to convert opportunities');
    }

    const { id: opportunityId } = params;

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // Get user record using admin client
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Get opportunity using admin client
    const { data: opportunity, error: opportunityError } = await adminClient
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
      // Check if project already exists using admin client
      const { data: existingProject } = await adminClient
        .from('projects')
        .select('id')
        .eq('opportunity_id', opportunityId)
        .single();

      if (existingProject) {
        return conflict('This opportunity has already been converted to a project');
      }
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get request body for template_id and member_ids
    const body = await request.json().catch(() => ({}));
    const { template_id, member_ids } = body;

    // Convert opportunity to project using admin client
    const project = await convertOpportunityToProject(
      adminClient,
      opportunity,
      userData.id,
      organizationId,
      template_id || null,
      member_ids || []
    );

    // Update opportunity status to 'converted' using admin client
    await adminClient
      .from('opportunities')
      .update({ status: 'converted' })
      .eq('id', opportunityId);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/opportunities/[id]/convert:', error);
    return internalError('Failed to convert opportunity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

