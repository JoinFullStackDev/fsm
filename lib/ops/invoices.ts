import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type { Invoice, InvoiceLineItem, InvoicePayment, InvoiceWithRelations } from '@/types/ops';

/**
 * Validate invoice data before save
 */
export function validateInvoiceData(data: {
  client_name?: string;
  line_items?: InvoiceLineItem[];
  subtotal?: number;
  tax_rate?: number;
  total_amount?: number;
}): { valid: boolean; error?: string } {
  if (!data.client_name || data.client_name.trim() === '') {
    return { valid: false, error: 'Client name is required' };
  }

  if (!data.line_items || data.line_items.length === 0) {
    return { valid: false, error: 'At least one line item is required' };
  }

  // Validate line items
  for (const item of data.line_items) {
    if (!item.description || item.description.trim() === '') {
      return { valid: false, error: 'Line item description is required' };
    }
    if (item.quantity <= 0) {
      return { valid: false, error: 'Line item quantity must be greater than 0' };
    }
    if (item.unit_price < 0) {
      return { valid: false, error: 'Line item unit price cannot be negative' };
    }
    if (item.amount < 0) {
      return { valid: false, error: 'Line item amount cannot be negative' };
    }
  }

  if (data.tax_rate !== undefined && (data.tax_rate < 0 || data.tax_rate > 100)) {
    return { valid: false, error: 'Tax rate must be between 0 and 100' };
  }

  if (data.subtotal !== undefined && data.subtotal < 0) {
    return { valid: false, error: 'Subtotal cannot be negative' };
  }

  if (data.total_amount !== undefined && data.total_amount < 0) {
    return { valid: false, error: 'Total amount cannot be negative' };
  }

  return { valid: true };
}

/**
 * Calculate invoice totals from line items
 */
export function calculateInvoiceTotals(
  lineItems: InvoiceLineItem[],
  taxRate: number = 0
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Generate unique invoice number with retry logic
 */
export async function generateInvoiceNumber(
  supabase: SupabaseClient,
  orgPrefix?: string | null
): Promise<string> {
  const adminClient = createAdminSupabaseClient();
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      const { data, error } = await adminClient.rpc('generate_invoice_number', {
        org_prefix: orgPrefix || null,
      });

      if (error) {
        throw error;
      }

      if (data) {
        // Verify uniqueness
        const { data: existing } = await adminClient
          .from('invoices')
          .select('id')
          .eq('invoice_number', data)
          .single();

        if (!existing) {
          return data;
        }
      }

      attempts++;
      if (attempts < maxAttempts) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempts)));
      }
    } catch (error) {
      logger.error('Error generating invoice number:', error);
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempts)));
      } else {
        // Fallback to timestamp-based number
        const year = new Date().getFullYear();
        const timestamp = Date.now();
        return `${orgPrefix || 'INV'}-${year}-${timestamp.toString().slice(-6)}`;
      }
    }
  }

  // Final fallback
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  return `${orgPrefix || 'INV'}-${year}-${timestamp.toString().slice(-6)}`;
}

/**
 * Create invoice with validation and line items
 */
export async function createInvoice(
  supabase: SupabaseClient,
  data: {
    organization_id: string;
    project_id?: string | null;
    opportunity_id?: string | null;
    company_id?: string | null;
    client_name: string;
    client_email?: string | null;
    client_address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    } | null;
    line_items: InvoiceLineItem[];
    issue_date?: string;
    due_date?: string | null;
    tax_rate?: number;
    notes?: string | null;
    terms?: string | null;
    is_recurring?: boolean;
    recurring_frequency?: 'monthly' | 'quarterly' | 'yearly' | null;
    recurring_end_date?: string | null;
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    created_by?: string | null;
    invoice_number_prefix?: string | null;
  }
): Promise<Invoice> {
  const adminClient = createAdminSupabaseClient();

  // Validate data
  const validation = validateInvoiceData({
    client_name: data.client_name,
    line_items: data.line_items,
    tax_rate: data.tax_rate || 0,
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid invoice data');
  }

  // Calculate totals
  const taxRate = data.tax_rate || 0;
  const { subtotal, taxAmount, total } = calculateInvoiceTotals(data.line_items, taxRate);

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(supabase, data.invoice_number_prefix);

  // Calculate next invoice date for recurring invoices
  let nextInvoiceDate: string | null = null;
  if (data.is_recurring && data.recurring_frequency) {
    const issueDate = data.issue_date ? new Date(data.issue_date) : new Date();
    const nextDate = new Date(issueDate);
    
    switch (data.recurring_frequency) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    
    nextInvoiceDate = nextDate.toISOString().split('T')[0];
  }

  // Create invoice
  const { data: invoice, error: invoiceError } = await adminClient
    .from('invoices')
    .insert({
      organization_id: data.organization_id,
      project_id: data.project_id || null,
      opportunity_id: data.opportunity_id || null,
      company_id: data.company_id || null,
      invoice_number: invoiceNumber,
      status: data.status || 'draft',
      client_name: data.client_name,
      client_email: data.client_email || null,
      client_address: data.client_address || null,
      issue_date: data.issue_date || new Date().toISOString().split('T')[0],
      due_date: data.due_date || null,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: total,
      currency: 'USD',
      notes: data.notes || null,
      terms: data.terms || null,
      is_recurring: data.is_recurring || false,
      recurring_frequency: data.recurring_frequency || null,
      recurring_end_date: data.recurring_end_date || null,
      next_invoice_date: nextInvoiceDate,
      created_by: data.created_by || null,
    })
    .select()
    .single();

  if (invoiceError || !invoice) {
    logger.error('Error creating invoice:', invoiceError);
    throw invoiceError || new Error('Failed to create invoice');
  }

  // Create line items
  if (data.line_items && data.line_items.length > 0) {
    const lineItemInserts = data.line_items.map((item, index) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      display_order: index,
    }));

    const { error: lineItemsError } = await adminClient
      .from('invoice_line_items')
      .insert(lineItemInserts);

    if (lineItemsError) {
      logger.error('Error creating invoice line items:', lineItemsError);
      // Don't fail the whole operation, but log the error
    }
  }

  return invoice;
}

/**
 * Update invoice (only if draft status)
 */
export async function updateInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  data: {
    client_name?: string;
    client_email?: string | null;
    client_address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    } | null;
    line_items?: InvoiceLineItem[];
    issue_date?: string;
    due_date?: string | null;
    tax_rate?: number;
    notes?: string | null;
    terms?: string | null;
    is_recurring?: boolean;
    recurring_frequency?: 'monthly' | 'quarterly' | 'yearly' | null;
    recurring_end_date?: string | null;
    updated_by?: string | null;
  }
): Promise<Invoice> {
  const adminClient = createAdminSupabaseClient();

  // Get current invoice to check status and get existing values
  const { data: currentInvoice, error: fetchError } = await adminClient
    .from('invoices')
    .select('status, client_name, tax_rate, issue_date')
    .eq('id', invoiceId)
    .single();

  if (fetchError || !currentInvoice) {
    throw new Error('Invoice not found');
  }

  if (currentInvoice.status !== 'draft') {
    throw new Error('Only draft invoices can be edited');
  }

  // Validate if line items are being updated
  if (data.line_items) {
    const validation = validateInvoiceData({
      client_name: data.client_name || (currentInvoice.client_name as string),
      line_items: data.line_items,
      tax_rate: data.tax_rate !== undefined ? data.tax_rate : (currentInvoice.tax_rate as number),
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid invoice data');
    }
  }

  // Calculate totals if line items are updated
  const updateData: Partial<Invoice> = {
    updated_by: data.updated_by || null,
  };

  if (data.line_items) {
    const taxRate = data.tax_rate !== undefined ? data.tax_rate : currentInvoice.tax_rate;
    const { subtotal, taxAmount, total } = calculateInvoiceTotals(data.line_items, taxRate);
    updateData.subtotal = subtotal;
    updateData.tax_rate = taxRate;
    updateData.tax_amount = taxAmount;
    updateData.total_amount = total;
  } else if (data.tax_rate !== undefined) {
    // Recalculate totals with new tax rate
    const { data: lineItems } = await adminClient
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('display_order');

    if (lineItems && lineItems.length > 0) {
      const { subtotal, taxAmount, total } = calculateInvoiceTotals(
        lineItems as InvoiceLineItem[],
        data.tax_rate
      );
      updateData.subtotal = subtotal;
      updateData.tax_rate = data.tax_rate;
      updateData.tax_amount = taxAmount;
      updateData.total_amount = total;
    }
  }

  // Add other fields
  if (data.client_name !== undefined) updateData.client_name = data.client_name;
  if (data.client_email !== undefined) updateData.client_email = data.client_email;
  if (data.client_address !== undefined) updateData.client_address = data.client_address;
  if (data.issue_date !== undefined) updateData.issue_date = data.issue_date;
  if (data.due_date !== undefined) updateData.due_date = data.due_date;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.terms !== undefined) updateData.terms = data.terms;
  if (data.is_recurring !== undefined) updateData.is_recurring = data.is_recurring;
  if (data.recurring_frequency !== undefined) updateData.recurring_frequency = data.recurring_frequency;
  if (data.recurring_end_date !== undefined) updateData.recurring_end_date = data.recurring_end_date;

  // Calculate next invoice date for recurring invoices
  if (data.is_recurring && data.recurring_frequency) {
    const issueDate = data.issue_date ? new Date(data.issue_date) : new Date(currentInvoice.issue_date as string);
    const nextDate = new Date(issueDate);
    
    switch (data.recurring_frequency) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    
    updateData.next_invoice_date = nextDate.toISOString().split('T')[0];
  }

  // Update invoice
  const { data: invoice, error: updateError } = await adminClient
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError || !invoice) {
    logger.error('Error updating invoice:', updateError);
    throw updateError || new Error('Failed to update invoice');
  }

  // Update line items if provided
  if (data.line_items) {
    // Delete existing line items
    await adminClient.from('invoice_line_items').delete().eq('invoice_id', invoiceId);

    // Insert new line items
    const lineItemInserts = data.line_items.map((item, index) => ({
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      display_order: index,
    }));

    const { error: lineItemsError } = await adminClient
      .from('invoice_line_items')
      .insert(lineItemInserts);

    if (lineItemsError) {
      logger.error('Error updating invoice line items:', lineItemsError);
      throw new Error('Failed to update invoice line items');
    }
  }

  return invoice;
}

/**
 * Soft delete invoice
 */
export async function deleteInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  userId?: string | null
): Promise<void> {
  const adminClient = createAdminSupabaseClient();

  const { error } = await adminClient
    .from('invoices')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: userId || null,
    })
    .eq('id', invoiceId);

  if (error) {
    logger.error('Error deleting invoice:', error);
    throw error;
  }
}

/**
 * Get invoice with relations
 */
export async function getInvoice(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<InvoiceWithRelations | null> {
  const adminClient = createAdminSupabaseClient();

  const { data: invoice, error } = await adminClient
    .from('invoices')
    .select(`
      *,
      project:projects(id, name),
      company:companies(id, name),
      opportunity:opportunities(id, name),
      created_user:users!invoices_created_by_fkey(id, name, email)
    `)
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (error || !invoice) {
    if (error?.code === 'PGRST116') {
      return null;
    }
    logger.error('Error fetching invoice:', error);
    throw error || new Error('Failed to fetch invoice');
  }

  // Get line items
  const { data: lineItems } = await adminClient
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('display_order');

  // Get payments
  const { data: payments } = await adminClient
    .from('invoice_payments')
    .select(`
      *,
      created_user:users!invoice_payments_created_by_fkey(id, name, email)
    `)
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false });

  // Get history
  const { data: history } = await adminClient
    .from('invoice_history')
    .select(`
      *,
      changed_user:users!invoice_history_changed_by_fkey(id, name, email)
    `)
    .eq('invoice_id', invoiceId)
    .order('changed_at', { ascending: false });

  return {
    ...invoice,
    line_items: lineItems || [],
    payments: payments || [],
    history: history || [],
  } as InvoiceWithRelations;
}

/**
 * List invoices with pagination and filters
 */
export async function listInvoices(
  supabase: SupabaseClient,
  organizationId: string,
  options: {
    status?: string;
    project_id?: string;
    company_id?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ invoices: InvoiceWithRelations[]; total: number }> {
  const adminClient = createAdminSupabaseClient();

  let query = adminClient
    .from('invoices')
    .select(`
      *,
      project:projects(id, name),
      company:companies(id, name),
      opportunity:opportunities(id, name)
    `, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.project_id) {
    query = query.eq('project_id', options.project_id);
  }

  if (options.company_id) {
    query = query.eq('company_id', options.company_id);
  }

  const orderBy = options.orderBy || 'created_at';
  const orderDirection = options.orderDirection || 'desc';
  query = query.order(orderBy, { ascending: orderDirection === 'asc' });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data: invoices, error, count } = await query;

  if (error) {
    logger.error('Error listing invoices:', error);
    throw error;
  }

  return {
    invoices: (invoices || []) as InvoiceWithRelations[],
    total: count || 0,
  };
}

/**
 * Send invoice via email and update status
 */
export async function sendInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  sentToEmail: string,
  userId?: string | null
): Promise<Invoice> {
  const adminClient = createAdminSupabaseClient();

  const { data: invoice, error } = await adminClient
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_to_email: sentToEmail,
      updated_by: userId || null,
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error || !invoice) {
    logger.error('Error sending invoice:', error);
    throw error || new Error('Failed to send invoice');
  }

  return invoice;
}

/**
 * Record payment and update invoice status
 */
export async function markInvoicePaid(
  supabase: SupabaseClient,
  invoiceId: string,
  paymentData: {
    amount: number;
    payment_date?: string;
    payment_method?: string | null;
    notes?: string | null;
    created_by?: string | null;
  }
): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
  const adminClient = createAdminSupabaseClient();

  // Get current invoice
  const { data: invoice, error: invoiceError } = await adminClient
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error('Invoice not found');
  }

  // Create payment record
  const { data: payment, error: paymentError } = await adminClient
    .from('invoice_payments')
    .insert({
      invoice_id: invoiceId,
      amount: paymentData.amount,
      payment_date: paymentData.payment_date || new Date().toISOString().split('T')[0],
      payment_method: paymentData.payment_method || null,
      notes: paymentData.notes || null,
      created_by: paymentData.created_by || null,
    })
    .select()
    .single();

  if (paymentError || !payment) {
    logger.error('Error creating payment:', paymentError);
    throw paymentError || new Error('Failed to create payment');
  }

  // Calculate total paid amount
  const { data: allPayments } = await adminClient
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId);

  const totalPaid = (allPayments || []).reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  const invoiceTotal = parseFloat(invoice.total_amount.toString());

  // Update invoice status if fully paid
  const updateData: Partial<Invoice> = {};
  if (totalPaid >= invoiceTotal) {
    updateData.status = 'paid';
  }

  if (Object.keys(updateData).length > 0) {
    const { data: updatedInvoice, error: updateError } = await adminClient
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating invoice status:', updateError);
    } else if (updatedInvoice) {
      return { invoice: updatedInvoice, payment };
    }
  }

  return { invoice, payment };
}

/**
 * Generate next invoice in recurring series
 */
export async function generateRecurringInvoice(
  supabase: SupabaseClient,
  parentInvoiceId: string
): Promise<Invoice> {
  const adminClient = createAdminSupabaseClient();

  // Get parent invoice
  const { data: parentInvoice, error: parentError } = await adminClient
    .from('invoices')
    .select('*')
    .eq('id', parentInvoiceId)
    .single();

  if (parentError || !parentInvoice) {
    throw new Error('Parent invoice not found');
  }

  if (!parentInvoice.is_recurring || !parentInvoice.recurring_frequency) {
    throw new Error('Parent invoice is not a recurring invoice');
  }

  if (parentInvoice.recurring_end_date) {
    const endDate = new Date(parentInvoice.recurring_end_date);
    const today = new Date();
    if (today > endDate) {
      throw new Error('Recurring invoice series has ended');
    }
  }

  if (!parentInvoice.next_invoice_date) {
    throw new Error('Next invoice date is not set');
  }

  const nextDate = new Date(parentInvoice.next_invoice_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDate.setHours(0, 0, 0, 0);

  if (nextDate > today) {
    throw new Error('Next invoice date has not been reached');
  }

  // Get line items from parent invoice
  const { data: parentLineItems } = await adminClient
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', parentInvoiceId)
    .order('display_order');

  // Calculate new dates
  const newIssueDate = new Date(parentInvoice.next_invoice_date);
  let newDueDate: Date | null = null;
  if (parentInvoice.due_date) {
    const oldDueDate = new Date(parentInvoice.due_date);
    const oldIssueDate = new Date(parentInvoice.issue_date);
    const daysDiff = Math.floor((oldDueDate.getTime() - oldIssueDate.getTime()) / (1000 * 60 * 60 * 24));
    newDueDate = new Date(newIssueDate);
    newDueDate.setDate(newDueDate.getDate() + daysDiff);
  }

  // Calculate next invoice date
  let nextInvoiceDate: Date | null = null;
  if (parentInvoice.recurring_frequency) {
    const nextDate = new Date(newIssueDate);
    switch (parentInvoice.recurring_frequency) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    nextInvoiceDate = nextDate;
  }

  // Create new invoice
  const newInvoice = await createInvoice(supabase, {
    organization_id: parentInvoice.organization_id,
    project_id: parentInvoice.project_id,
    opportunity_id: parentInvoice.opportunity_id,
    company_id: parentInvoice.company_id,
    client_name: parentInvoice.client_name,
    client_email: parentInvoice.client_email,
    client_address: parentInvoice.client_address as {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    } | null,
    line_items: (parentLineItems || []) as InvoiceLineItem[],
    issue_date: newIssueDate.toISOString().split('T')[0],
    due_date: newDueDate ? newDueDate.toISOString().split('T')[0] : null,
    tax_rate: parentInvoice.tax_rate,
    notes: parentInvoice.notes,
    terms: parentInvoice.terms,
    is_recurring: true,
    recurring_frequency: parentInvoice.recurring_frequency,
    recurring_end_date: parentInvoice.recurring_end_date,
    status: 'draft',
    created_by: parentInvoice.created_by,
    invoice_number_prefix: parentInvoice.invoice_number.split('-')[0],
  });

  // Update parent invoice's next_invoice_date
  await adminClient
    .from('invoices')
    .update({
      next_invoice_date: nextInvoiceDate ? nextInvoiceDate.toISOString().split('T')[0] : null,
    })
    .eq('id', parentInvoiceId);

  // Set parent_invoice_id on new invoice
  await adminClient
    .from('invoices')
    .update({
      parent_invoice_id: parentInvoiceId,
    })
    .eq('id', newInvoice.id);

  return newInvoice;
}

