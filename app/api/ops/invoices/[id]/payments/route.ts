import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { getInvoice, markInvoicePaid } from '@/lib/ops/invoices';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/invoices/[id]/payments
 * Record payment for invoice
 */
export async function POST(
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

    // Get user ID
    const { createAdminSupabaseClient } = await import('@/lib/supabaseAdmin');
    const adminClient = createAdminSupabaseClient();
    const { data: userData } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    // Get invoice
    const invoice = await getInvoice(supabase, params.id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Verify organization access
    if (invoice.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { amount, payment_date, payment_method, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount is required and must be greater than 0' },
        { status: 400 }
      );
    }

    const result = await markInvoicePaid(supabase, params.id, {
      amount: parseFloat(amount),
      payment_date: payment_date || undefined,
      payment_method: payment_method || null,
      notes: notes || null,
      created_by: userData?.id || null,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in POST /api/ops/invoices/[id]/payments:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

