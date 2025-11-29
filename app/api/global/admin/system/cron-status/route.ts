import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/system/cron-status
 * Get cron job status and subscription statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get subscription statistics
    const { data: subscriptions, error: subscriptionsError } = await adminClient
      .from('dashboard_subscriptions')
      .select('id, schedule_type, enabled, last_sent_at, created_at');

    if (subscriptionsError) {
      logger.error('[Cron Status] Error fetching subscriptions:', subscriptionsError);
      return internalError('Failed to fetch subscription data');
    }

    // Calculate statistics
    const total = subscriptions?.length || 0;
    const enabled = subscriptions?.filter(s => s.enabled).length || 0;
    const disabled = total - enabled;

    // Group by schedule type
    const bySchedule: Record<string, number> = {};
    subscriptions?.forEach((sub: any) => {
      bySchedule[sub.schedule_type] = (bySchedule[sub.schedule_type] || 0) + 1;
    });

    // Count due subscriptions
    const now = new Date();
    let dueCount = 0;
    subscriptions?.forEach((sub: any) => {
      if (!sub.enabled) return;
      
      const lastSent = sub.last_sent_at ? new Date(sub.last_sent_at) : null;
      let isDue = false;

      if (!lastSent) {
        isDue = true; // Never sent
      } else if (sub.schedule_type === 'daily') {
        isDue = (now.getTime() - lastSent.getTime()) > 24 * 60 * 60 * 1000;
      } else if (sub.schedule_type === 'weekly') {
        isDue = (now.getTime() - lastSent.getTime()) > 7 * 24 * 60 * 60 * 1000;
      } else if (sub.schedule_type === 'monthly') {
        isDue = (now.getTime() - lastSent.getTime()) > 30 * 24 * 60 * 60 * 1000;
      }

      if (isDue) dueCount++;
    });

    // Get recent activity (last 10 sent reports)
    const recentActivity = subscriptions
      ?.filter((s: any) => s.last_sent_at)
      .sort((a: any, b: any) => 
        new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime()
      )
      .slice(0, 10)
      .map((s: any) => ({
        id: s.id,
        schedule_type: s.schedule_type,
        last_sent_at: s.last_sent_at,
      })) || [];

    return NextResponse.json({
      statistics: {
        total,
        enabled,
        disabled,
        due: dueCount,
        bySchedule,
      },
      recentActivity,
      cronEndpoint: '/api/cron/dashboard-reports',
      cronSecretConfigured: !!process.env.CRON_SECRET,
    });
  } catch (error) {
    logger.error('[Cron Status] Error:', error);
    return internalError('Failed to get cron status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/global/admin/system/cron-status
 * Manually trigger the cron job (for testing)
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    const cronSecret = process.env.CRON_SECRET;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (cronSecret) {
      headers['Authorization'] = `Bearer ${cronSecret}`;
    }

    const response = await fetch(`${baseUrl}/api/cron/dashboard-reports`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cron job failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Cron job triggered successfully',
      result: data,
    });
  } catch (error) {
    logger.error('[Cron Status] Error triggering cron:', error);
    return internalError('Failed to trigger cron job', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

