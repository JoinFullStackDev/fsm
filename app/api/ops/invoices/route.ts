import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { createInvoice, listInvoices } from '@/lib/ops/invoices';
import logger from '@/lib/utils/logger';
import type { InvoiceLineItem } from '@/types/ops';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ops/invoices
 * List invoices with pagination and filters
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const projectId = searchParams.get('project_id');
    const companyId = searchParams.get('company_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const orderBy = searchParams.get('order_by') || 'created_at';
    const orderDirection = (searchParams.get('order_direction') || 'desc') as 'asc' | 'desc';

    const result = await listInvoices(supabase, organizationId, {
      status: status || undefined,
      project_id: projectId || undefined,
      company_id: companyId || undefined,
      limit,
      offset,
      orderBy,
      orderDirection,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in GET /api/ops/invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ops/invoices
 * Create invoice
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

    // Get user ID
    const { createAdminSupabaseClient } = await import('@/lib/supabaseAdmin');
    const adminClient = createAdminSupabaseClient();
    const { data: userData } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    const body = await request.json();
    const {
      project_id,
      opportunity_id,
      company_id,
      client_name,
      client_email,
      client_address,
      line_items,
      issue_date,
      due_date,
      tax_rate,
      notes,
      terms,
      is_recurring,
      recurring_frequency,
      recurring_end_date,
      status,
      invoice_number_prefix,
    } = body;

    if (!client_name || !line_items || line_items.length === 0) {
      return NextResponse.json(
        { error: 'Client name and line items are required' },
        { status: 400 }
      );
    }

    // Validate line items format
    const validatedLineItems: InvoiceLineItem[] = line_items.map((item: any) => ({
      description: item.description,
      quantity: parseFloat(item.quantity) || 1,
      unit_price: parseFloat(item.unit_price) || 0,
      amount: parseFloat(item.amount) || parseFloat(item.quantity) * parseFloat(item.unit_price) || 0,
    }));

    const invoice = await createInvoice(supabase, {
      organization_id: organizationId,
      project_id: project_id || null,
      opportunity_id: opportunity_id || null,
      company_id: company_id || null,
      client_name,
      client_email: client_email || null,
      client_address: client_address || null,
      line_items: validatedLineItems,
      issue_date: issue_date || undefined,
      due_date: due_date || null,
      tax_rate: tax_rate ? parseFloat(tax_rate) : 0,
      notes: notes || null,
      terms: terms || null,
      is_recurring: is_recurring || false,
      recurring_frequency: recurring_frequency || null,
      recurring_end_date: recurring_end_date || null,
      status: status || 'draft',
      created_by: userData?.id || null,
      invoice_number_prefix: invoice_number_prefix || null,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/invoices:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

