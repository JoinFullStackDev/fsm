import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';
import { createCheckoutSession } from '@/lib/stripe/subscriptions';
import { badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/organizations/[id]/payments
 * Get payment history (invoices) from Stripe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get organization
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('id', params.id)
      .single();

    if (orgError || !organization) {
      return notFound('Organization not found');
    }

    if (!organization.stripe_customer_id) {
      return NextResponse.json({ invoices: [] });
    }

    if (!(await isStripeConfigured())) {
      return NextResponse.json({ invoices: [], message: 'Stripe is not configured' });
    }

    const stripe = await getStripeClient();

    // Get invoices for this customer
    const invoices = await stripe.invoices.list({
      customer: organization.stripe_customer_id,
      limit: 100,
    });

    const formattedInvoices = invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount_due: invoice.amount_due / 100, // Convert from cents
      amount_paid: invoice.amount_paid / 100,
      status: invoice.status,
      created: new Date(invoice.created * 1000).toISOString(),
      due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      paid_at: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      description: invoice.description || invoice.lines.data[0]?.description || '',
    }));

    return NextResponse.json({ invoices: formattedInvoices });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error in GET /api/global/admin/organizations/[id]/payments:', error);
    return internalError('Failed to fetch payments', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/global/admin/organizations/[id]/payments
 * Create payment collection (checkout session or invoice)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body = await request.json();
    const { package_id, amount, description } = body;

    if (!(await isStripeConfigured())) {
      return badRequest('Stripe is not configured');
    }

    // Get organization
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('id, stripe_customer_id, name')
      .eq('id', params.id)
      .single();

    if (orgError || !organization) {
      return notFound('Organization not found');
    }

    // Get Stripe client
    const stripe = await getStripeClient();

    // Ensure customer exists
    let customerId = organization.stripe_customer_id;
    if (!customerId) {
      // Get organization owner
      const { data: owner } = await adminClient
        .from('users')
        .select('email, name')
        .eq('organization_id', params.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!owner) {
        return badRequest('Organization has no owner');
      }

      const customer = await stripe.customers.create({
        email: owner.email,
        name: owner.name || organization.name,
        metadata: { organization_id: params.id },
      });

      customerId = customer.id;
      await adminClient
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', params.id);
    }

    // If package_id provided, create checkout session
    if (package_id) {
      const checkoutUrl = await createCheckoutSession(
        params.id,
        package_id,
        `${request.headers.get('origin')}/global/admin/organizations/${params.id}?payment=success`,
        `${request.headers.get('origin')}/global/admin/organizations/${params.id}?payment=cancelled`
      );

      if (!checkoutUrl) {
        return internalError('Failed to create checkout session');
      }

      return NextResponse.json({ checkout_url: checkoutUrl });
    }

    // Otherwise, create an invoice
    if (!amount || amount <= 0) {
      return badRequest('Amount is required and must be greater than 0');
    }

    // Create invoice with line items (Stripe requires line items, not direct amount)
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30,
      metadata: {
        organization_id: params.id,
        admin_collected: 'true',
      },
    });

    // Add line item to the invoice
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      description: description || `Payment for ${organization.name}`,
    });

    // Retrieve the updated invoice with line items
    const updatedInvoice = await stripe.invoices.retrieve(invoice.id);

    // Finalize and send invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(updatedInvoice.id);
    await stripe.invoices.sendInvoice(finalizedInvoice.id);

    return NextResponse.json({
      invoice_id: finalizedInvoice.id,
      invoice_url: finalizedInvoice.hosted_invoice_url,
      message: 'Invoice created and sent',
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error in POST /api/global/admin/organizations/[id]/payments:', error);
    return internalError('Failed to create payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

