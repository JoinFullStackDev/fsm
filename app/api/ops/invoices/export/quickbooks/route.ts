import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { listInvoices } from '@/lib/ops/invoices';
import { exportInvoicesToQuickBooks } from '@/lib/ops/invoiceExport';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/invoices/export/quickbooks
 * Export selected invoices to QuickBooks IIF format
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const { invoice_ids, filters } = body;

    let invoices;

    if (invoice_ids && Array.isArray(invoice_ids) && invoice_ids.length > 0) {
      // Export specific invoices
      const results = await Promise.all(
        invoice_ids.map((id: string) => {
          const { getInvoice } = require('@/lib/ops/invoices');
          return getInvoice(supabase, id);
        })
      );
      invoices = results.filter((inv) => inv !== null && inv.organization_id === organizationId);
    } else {
      // Export based on filters
      const result = await listInvoices(supabase, organizationId, {
        status: filters?.status,
        project_id: filters?.project_id,
        company_id: filters?.company_id,
        limit: filters?.limit || 1000,
        offset: 0,
      });
      invoices = result.invoices;
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json(
        { error: 'No invoices found to export' },
        { status: 400 }
      );
    }

    const iif = exportInvoicesToQuickBooks(invoices);

    return new NextResponse(iif, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="invoices-quickbooks-${new Date().toISOString().split('T')[0]}.iif"`,
      },
    });
  } catch (error) {
    logger.error('Error in POST /api/ops/invoices/export/quickbooks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

