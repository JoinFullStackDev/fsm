import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, getOrganizationContextById } from '@/lib/organizationContext';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import type { Feedback, TrendingFeedback } from '@/types/workspace-extended';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/[projectId]/discovery/feedback/trending
 * Get trending feedback by category
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
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

    // Get all feedback (focus on feature requests and complaints)
    const { data: allFeedback, error } = await adminClient
      .from('workspace_feedback')
      .select('*')
      .eq('workspace_id', workspace.id)
      .in('feedback_type', ['feature_request', 'complaint'])
      .in('status', ['open', 'under_review', 'planned'])
      .order('upvote_count', { ascending: false });

    if (error) {
      logger.error('[Discovery API] Failed to fetch feedback:', error);
      return internalError('Failed to fetch feedback');
    }

    // Aggregate by category
    const categoryMap = new Map<string, Feedback[]>();

    (allFeedback || []).forEach((feedback: Feedback) => {
      const categories = feedback.category || [];
      if (categories.length === 0) {
        // Add to 'Uncategorized'
        if (!categoryMap.has('Uncategorized')) {
          categoryMap.set('Uncategorized', []);
        }
        categoryMap.get('Uncategorized')!.push(feedback);
      } else {
        categories.forEach((cat: string) => {
          if (!categoryMap.has(cat)) {
            categoryMap.set(cat, []);
          }
          categoryMap.get(cat)!.push(feedback);
        });
      }
    });

    // Build trending feedback array
    const trendingFeedback: TrendingFeedback[] = [];
    categoryMap.forEach((items, category) => {
      trendingFeedback.push({
        category,
        count: items.length,
        recent_items: items.slice(0, 5), // Top 5 items per category
      });
    });

    // Sort by count descending
    trendingFeedback.sort((a, b) => b.count - a.count);

    // Return top 10 categories
    return NextResponse.json(trendingFeedback.slice(0, 10));
  } catch (error) {
    logger.error('[Discovery API] Unexpected error:', error);
    return internalError('An unexpected error occurred');
  }
}

