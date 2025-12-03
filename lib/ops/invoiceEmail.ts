import { sendEmail, sendEmailWithRetry } from '@/lib/emailService';
import { getOrganizationContextById } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';
import type { Invoice, InvoiceWithRelations } from '@/types/ops';

/**
 * Generate HTML email template for invoice
 */
export async function generateInvoiceEmailTemplate(
  invoice: InvoiceWithRelations,
  organizationBranding?: { logo_url?: string | null; icon_url?: string | null; name?: string }
): Promise<{ subject: string; html: string; text: string }> {
  const logoUrl = organizationBranding?.logo_url || organizationBranding?.icon_url;
  const orgName = organizationBranding?.name || 'Your Organization';

  const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/ops/invoices/${invoice.id}`;
  const formattedDate = new Date(invoice.issue_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dueDateFormatted = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  const lineItemsHtml = invoice.line_items
    ?.map(
      (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right;">$${item.unit_price.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right;">$${item.amount.toFixed(2)}</td>
      </tr>
    `
    )
    .join('') || '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${logoUrl ? `<div style="text-align: center; margin-bottom: 30px;"><img src="${logoUrl}" alt="${orgName}" style="max-height: 60px;"></div>` : ''}
  
  <h1 style="color: #00E5FF; margin-bottom: 10px;">Invoice ${invoice.invoice_number}</h1>
  
  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
    <div style="margin-bottom: 15px;">
      <strong>Bill To:</strong><br>
      ${invoice.client_name}<br>
      ${invoice.client_email ? `${invoice.client_email}<br>` : ''}
      ${invoice.client_address?.street ? `${invoice.client_address.street}<br>` : ''}
      ${invoice.client_address?.city || invoice.client_address?.state || invoice.client_address?.zip
        ? `${[invoice.client_address.city, invoice.client_address.state, invoice.client_address.zip].filter(Boolean).join(', ')}<br>`
        : ''}
      ${invoice.client_address?.country ? `${invoice.client_address.country}` : ''}
    </div>
    
    <div>
      <strong>Invoice Date:</strong> ${formattedDate}<br>
      ${invoice.due_date ? `<strong>Due Date:</strong> ${dueDateFormatted}` : ''}
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
    <thead>
      <tr style="background-color: #00E5FF; color: white;">
        <th style="padding: 12px; text-align: left;">Description</th>
        <th style="padding: 12px; text-align: center;">Quantity</th>
        <th style="padding: 12px; text-align: right;">Unit Price</th>
        <th style="padding: 12px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHtml}
    </tbody>
  </table>

  <div style="text-align: right; margin-bottom: 30px;">
    <div style="margin-bottom: 10px;">
      <strong>Subtotal:</strong> $${invoice.subtotal.toFixed(2)}
    </div>
    ${invoice.tax_rate > 0 ? `
    <div style="margin-bottom: 10px;">
      <strong>Tax (${invoice.tax_rate}%):</strong> $${invoice.tax_amount.toFixed(2)}
    </div>
    ` : ''}
    <div style="font-size: 18px; font-weight: bold; color: #00E5FF; padding-top: 10px; border-top: 2px solid #00E5FF;">
      <strong>Total:</strong> $${invoice.total_amount.toFixed(2)} ${invoice.currency}
    </div>
  </div>

  ${invoice.notes ? `
  <div style="margin-bottom: 20px;">
    <strong>Notes:</strong><br>
    <div style="white-space: pre-wrap;">${invoice.notes}</div>
  </div>
  ` : ''}

  ${invoice.terms ? `
  <div style="margin-bottom: 20px;">
    <strong>Terms:</strong><br>
    <div style="white-space: pre-wrap;">${invoice.terms}</div>
  </div>
  ` : ''}

  <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
    <a href="${invoiceUrl}" style="display: inline-block; background-color: #00E5FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Invoice Online</a>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
    <p>This invoice was sent by ${orgName}</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Invoice ${invoice.invoice_number}

Bill To:
${invoice.client_name}
${invoice.client_email || ''}
${invoice.client_address?.street || ''}
${[invoice.client_address?.city, invoice.client_address?.state, invoice.client_address?.zip].filter(Boolean).join(', ') || ''}
${invoice.client_address?.country || ''}

Invoice Date: ${formattedDate}
${invoice.due_date ? `Due Date: ${dueDateFormatted}` : ''}

Items:
${invoice.line_items?.map((item) => `${item.description} - Qty: ${item.quantity} @ $${item.unit_price.toFixed(2)} = $${item.amount.toFixed(2)}`).join('\n') || ''}

Subtotal: $${invoice.subtotal.toFixed(2)}
${invoice.tax_rate > 0 ? `Tax (${invoice.tax_rate}%): $${invoice.tax_amount.toFixed(2)}\n` : ''}Total: $${invoice.total_amount.toFixed(2)} ${invoice.currency}

${invoice.notes ? `Notes:\n${invoice.notes}\n` : ''}
${invoice.terms ? `Terms:\n${invoice.terms}\n` : ''}

View invoice online: ${invoiceUrl}

This invoice was sent by ${orgName}
  `.trim();

  return {
    subject: `Invoice ${invoice.invoice_number} from ${orgName}`,
    html,
    text,
  };
}

/**
 * Send invoice via email
 */
export async function sendInvoiceEmail(
  invoice: InvoiceWithRelations,
  recipientEmail: string,
  organizationId: string,
  pdfBuffer?: Buffer
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get organization branding
    const { createServerSupabaseClient } = await import('@/lib/supabaseServer');
    const supabase = await createServerSupabaseClient();
    const orgContext = await getOrganizationContextById(supabase, organizationId);

    const organizationBranding = orgContext
      ? {
          logo_url: orgContext.organization.logo_url,
          icon_url: orgContext.organization.icon_url,
          name: orgContext.organization.name,
        }
      : undefined;

    // Generate email template
    const { subject, html, text } = await generateInvoiceEmailTemplate(invoice, organizationBranding);

    // Send email with PDF attachment if provided
    if (pdfBuffer) {
      // Note: sendEmail doesn't support attachments directly
      // We'll need to use SendGrid API directly for attachments
      // For now, send without attachment and include link to PDF
      logger.info('PDF attachment not yet supported, sending email without attachment');
    }

    const result = await sendEmailWithRetry(recipientEmail, subject, html, text);

    if (!result.success) {
      logger.error('Failed to send invoice email:', result.error);
      return result;
    }

    logger.info('Invoice email sent successfully', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      recipientEmail,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error sending invoice email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

