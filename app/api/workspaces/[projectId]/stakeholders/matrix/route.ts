import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, badRequest, internalError, forbidden, notFound } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

const adminClient = createAdminSupabaseClient();
import type { Stakeholder, PowerInterestMatrix } from '@/types/workspace-extended';

// GET /api/workspaces/[projectId]/stakeholders/matrix - Get power/interest matrix
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

    const { data, error } = await adminClient
      .from('workspace_stakeholders')
      .select('*')
      .eq('workspace_id', workspace.id)
      .not('power_level', 'is', null)
      .not('interest_level', 'is', null);

    if (error) {
      logger.error('[Stakeholders API] Error fetching stakeholders for matrix:', error);
      return internalError('Failed to fetch stakeholder matrix');
    }

    const stakeholders: Stakeholder[] = data || [];

    // Organize into matrix quadrants
    const matrix: PowerInterestMatrix = {
      high_power_high_interest: [],
      high_power_low_interest: [],
      low_power_high_interest: [],
      low_power_low_interest: [],
    };

    stakeholders.forEach((stakeholder) => {
      const isHighPower = stakeholder.power_level === 'high';
      const isHighInterest = stakeholder.interest_level === 'high';

      if (isHighPower && isHighInterest) {
        matrix.high_power_high_interest.push(stakeholder);
      } else if (isHighPower && !isHighInterest) {
        matrix.high_power_low_interest.push(stakeholder);
      } else if (!isHighPower && isHighInterest) {
        matrix.low_power_high_interest.push(stakeholder);
      } else {
        matrix.low_power_low_interest.push(stakeholder);
      }
    });

    // Calculate summary stats
    const stats = {
      total_stakeholders: stakeholders.length,
      key_players: matrix.high_power_high_interest.length,
      keep_satisfied: matrix.high_power_low_interest.length,
      keep_informed: matrix.low_power_high_interest.length,
      monitor: matrix.low_power_low_interest.length,
      alignment_distribution: {
        champion: stakeholders.filter(s => s.alignment_status === 'champion').length,
        supporter: stakeholders.filter(s => s.alignment_status === 'supporter').length,
        neutral: stakeholders.filter(s => s.alignment_status === 'neutral').length,
        skeptical: stakeholders.filter(s => s.alignment_status === 'skeptical').length,
        blocker: stakeholders.filter(s => s.alignment_status === 'blocker').length,
      },
    };

    return NextResponse.json({ matrix, stats });
  } catch (error) {
    logger.error('[Stakeholders API] Unexpected error in GET matrix:', error);
    return internalError('An unexpected error occurred');
  }
}

