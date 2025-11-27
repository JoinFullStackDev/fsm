import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/ai-usage
 * Get AI usage statistics (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get AI usage from activity_logs (placeholder implementation)
    const { data: aiLogs, error } = await adminClient
      .from('activity_logs')
      .select('id')
      .eq('action', 'ai_used')
      .limit(1000);

    if (error) {
      logger.error('Error loading AI usage:', error);
    }

    return NextResponse.json({
      totalRequests: aiLogs?.length || 0,
      totalCost: 0,
      requestsThisMonth: aiLogs?.length || 0,
      organizations: [],
    });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/ai-usage:', error);
    return internalError('Failed to load AI usage', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

