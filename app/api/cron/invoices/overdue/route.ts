import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/invoices/overdue
 * Daily cron job to update invoice status to 'overdue'
 * Call this endpoint daily via Vercel Cron or external scheduler
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminSupabaseClient();

    // Call the database function to update overdue invoices
    const { data, error } = await adminClient.rpc('update_overdue_invoices');

    if (error) {
      logger.error('Error updating overdue invoices:', error);
      return NextResponse.json(
        { error: 'Failed to update overdue invoices', details: error.message },
        { status: 500 }
      );
    }

    logger.info('Overdue invoices updated successfully');

    return NextResponse.json({
      success: true,
      message: 'Overdue invoices updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error in overdue invoices cron job:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Allow GET for testing
export async function GET(request: NextRequest) {
  return POST(request);
}

