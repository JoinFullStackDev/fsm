import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { getOrganizationContextById } from '@/lib/organizationContext';
import { getInvoice } from '@/lib/ops/invoices';
import { generateInvoicePDF } from '@/lib/ops/invoicePdf';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ops/invoices/[id]/export/pdf
 * Download invoice as PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get invoice
    const invoice = await getInvoice(supabase, params.id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Verify organization access
    if (invoice.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get organization branding
    const orgContext = await getOrganizationContextById(supabase, organizationId);
    const organizationBranding = orgContext
      ? {
          logo_url: orgContext.organization.logo_url,
          icon_url: orgContext.organization.icon_url,
          name: orgContext.organization.name,
        }
      : undefined;

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF({
      invoice,
      organizationBranding,
    });

    // Convert Buffer to Uint8Array for Next.js compatibility
    const pdfArray = new Uint8Array(pdfBuffer);

    // Return PDF
    return new NextResponse(pdfArray, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
      },
    });
  } catch (error) {
    logger.error('Error in GET /api/ops/invoices/[id]/export/pdf:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

