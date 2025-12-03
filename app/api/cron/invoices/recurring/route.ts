import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { generateRecurringInvoice } from '@/lib/ops/invoices';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/invoices/recurring
 * Daily cron job to generate next invoice in recurring series
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

    const supabase = await createServerSupabaseClient();
    const adminClient = createAdminSupabaseClient();

    // Find invoices that need to generate the next invoice
    const today = new Date().toISOString().split('T')[0];
    
    const { data: recurringInvoices, error: fetchError } = await adminClient
      .from('invoices')
      .select('id, invoice_number, organization_id')
      .eq('is_recurring', true)
      .eq('next_invoice_date', today)
      .is('deleted_at', null)
      .is('recurring_end_date', null); // Only process if not ended

    if (fetchError) {
      logger.error('Error fetching recurring invoices:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch recurring invoices', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!recurringInvoices || recurringInvoices.length === 0) {
      logger.info('No recurring invoices to generate today');
      return NextResponse.json({
        success: true,
        message: 'No recurring invoices to generate',
        count: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const results = [];
    const errors = [];

    // Generate invoices for each recurring invoice
    for (const invoice of recurringInvoices) {
      try {
        const newInvoice = await generateRecurringInvoice(supabase, invoice.id);
        results.push({
          parent_invoice_id: invoice.id,
          parent_invoice_number: invoice.invoice_number,
          new_invoice_id: newInvoice.id,
          new_invoice_number: newInvoice.invoice_number,
        });
        logger.info('Generated recurring invoice', {
          parentInvoiceId: invoice.id,
          newInvoiceId: newInvoice.id,
        });
      } catch (error) {
        errors.push({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error('Error generating recurring invoice:', {
          invoiceId: invoice.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${recurringInvoices.length} recurring invoices`,
      generated: results.length,
      errorCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error in recurring invoices cron job:', error);
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

