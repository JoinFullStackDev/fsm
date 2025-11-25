import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { getActivityFeedForCompany } from '@/lib/ops/activityFeed';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view activity feed');
    }

    const { id: companyId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      if (companyError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error checking company:', companyError);
      return internalError('Failed to check company', { error: companyError?.message });
    }

    // Get activity feed
    const activityFeed = await getActivityFeedForCompany(supabase, companyId, limit);

    return NextResponse.json(activityFeed);
  } catch (error) {
    logger.error('Error in GET /api/ops/companies/[id]/activity:', error);
    return internalError('Failed to load activity feed', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

