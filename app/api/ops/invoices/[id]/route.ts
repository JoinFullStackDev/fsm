import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { getInvoice, updateInvoice, deleteInvoice } from '@/lib/ops/invoices';
import logger from '@/lib/utils/logger';
import type { InvoiceLineItem } from '@/types/ops';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ops/invoices/[id]
 * Get single invoice with relations
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

    const invoice = await getInvoice(supabase, params.id);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Verify organization access
    if (invoice.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    logger.error('Error in GET /api/ops/invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ops/invoices/[id]
 * Update invoice (only if draft status)
 */
export async function PUT(
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

    // Verify invoice exists and belongs to organization
    const currentInvoice = await getInvoice(supabase, params.id);
    if (!currentInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (currentInvoice.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
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
    } = body;

    // Validate line items if provided
    let validatedLineItems: InvoiceLineItem[] | undefined;
    if (line_items) {
      if (!Array.isArray(line_items) || line_items.length === 0) {
        return NextResponse.json(
          { error: 'Line items must be a non-empty array' },
          { status: 400 }
        );
      }

      interface LineItemInput {
        description: string;
        quantity: string | number;
        unit_price: string | number;
        amount?: string | number;
      }
      validatedLineItems = (line_items as LineItemInput[]).map((item) => ({
        description: item.description,
        quantity: parseFloat(String(item.quantity)) || 1,
        unit_price: parseFloat(String(item.unit_price)) || 0,
        amount: parseFloat(String(item.amount)) || parseFloat(String(item.quantity)) * parseFloat(String(item.unit_price)) || 0,
      }));
    }

    const invoice = await updateInvoice(supabase, params.id, {
      client_name,
      client_email,
      client_address,
      line_items: validatedLineItems,
      issue_date,
      due_date,
      tax_rate: tax_rate !== undefined ? parseFloat(tax_rate) : undefined,
      notes,
      terms,
      is_recurring,
      recurring_frequency,
      recurring_end_date,
      updated_by: userData?.id || null,
    });

    return NextResponse.json(invoice);
  } catch (error) {
    logger.error('Error in PUT /api/ops/invoices/[id]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ops/invoices/[id]
 * Soft delete invoice
 */
export async function DELETE(
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

    // Verify invoice exists and belongs to organization
    const invoice = await getInvoice(supabase, params.id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteInvoice(supabase, params.id, userData?.id || null);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/ops/invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

