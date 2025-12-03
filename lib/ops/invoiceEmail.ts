import { sendEmail, sendEmailWithRetry } from '@/lib/emailService';
import { getOrganizationContextById } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';
import type { Invoice, InvoiceWithRelations } from '@/types/ops';
import { generateEmailWrapper, EMAIL_BRAND_COLORS } from '@/lib/emailTemplateBase';

/**
 * Generate HTML email template for invoice
 */
export async function generateInvoiceEmailTemplate(
  invoice: InvoiceWithRelations,
  organizationBranding?: { logo_url?: string | null; icon_url?: string | null; name?: string },
  organizationId?: string | null
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
        <td style="padding: 12px; border-bottom: 1px solid ${EMAIL_BRAND_COLORS.border}; color: ${EMAIL_BRAND_COLORS.text}; font-size: 14px;">${item.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid ${EMAIL_BRAND_COLORS.border}; text-align: center; color: ${EMAIL_BRAND_COLORS.text}; font-size: 14px;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid ${EMAIL_BRAND_COLORS.border}; text-align: right; color: ${EMAIL_BRAND_COLORS.text}; font-size: 14px;">$${item.unit_price.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid ${EMAIL_BRAND_COLORS.border}; text-align: right; color: ${EMAIL_BRAND_COLORS.text}; font-size: 14px;">$${item.amount.toFixed(2)}</td>
      </tr>
    `
    )
    .join('') || '';

  const content = `
    <h1 style="margin-top: 0; color: ${EMAIL_BRAND_COLORS.primary}; font-size: 28px; font-weight: 600; margin-bottom: 24px;">Invoice ${invoice.invoice_number}</h1>
    
    <div style="background-color: ${EMAIL_BRAND_COLORS.background}; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <div style="margin-bottom: 16px;">
        <strong style="color: ${EMAIL_BRAND_COLORS.text}; font-size: 14px;">Bill To:</strong><br>
        <div style="color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6; margin-top: 4px;">
          ${invoice.client_name}<br>
          ${invoice.client_email ? `${invoice.client_email}<br>` : ''}
          ${invoice.client_address?.street ? `${invoice.client_address.street}<br>` : ''}
          ${invoice.client_address?.city || invoice.client_address?.state || invoice.client_address?.zip
            ? `${[invoice.client_address.city, invoice.client_address.state, invoice.client_address.zip].filter(Boolean).join(', ')}<br>`
            : ''}
          ${invoice.client_address?.country ? `${invoice.client_address.country}` : ''}
        </div>
      </div>
      
      <div>
        <strong style="color: ${EMAIL_BRAND_COLORS.text}; font-size: 14px;">Invoice Date:</strong> <span style="color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px;">${formattedDate}</span><br>
        ${invoice.due_date ? `<strong style="color: ${EMAIL_BRAND_COLORS.text}; font-size: 14px;">Due Date:</strong> <span style="color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px;">${dueDateFormatted}</span>` : ''}
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background-color: ${EMAIL_BRAND_COLORS.primary};">
          <th style="padding: 12px; text-align: left; color: ${EMAIL_BRAND_COLORS.white}; font-weight: 600; font-size: 14px;">Description</th>
          <th style="padding: 12px; text-align: center; color: ${EMAIL_BRAND_COLORS.white}; font-weight: 600; font-size: 14px;">Quantity</th>
          <th style="padding: 12px; text-align: right; color: ${EMAIL_BRAND_COLORS.white}; font-weight: 600; font-size: 14px;">Unit Price</th>
          <th style="padding: 12px; text-align: right; color: ${EMAIL_BRAND_COLORS.white}; font-weight: 600; font-size: 14px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
      </tbody>
    </table>

    <div style="text-align: right; margin-bottom: 24px;">
      <div style="margin-bottom: 8px; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px;">
        <strong>Subtotal:</strong> $${invoice.subtotal.toFixed(2)}
      </div>
      ${invoice.tax_rate > 0 ? `
      <div style="margin-bottom: 8px; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px;">
        <strong>Tax (${invoice.tax_rate}%):</strong> $${invoice.tax_amount.toFixed(2)}
      </div>
      ` : ''}
      <div style="font-size: 20px; font-weight: bold; color: ${EMAIL_BRAND_COLORS.primary}; padding-top: 12px; border-top: 2px solid ${EMAIL_BRAND_COLORS.primary}; margin-top: 12px;">
        <strong>Total:</strong> $${invoice.total_amount.toFixed(2)} ${invoice.currency}
      </div>
    </div>

    ${invoice.notes ? `
    <div style="margin-bottom: 20px; padding: 16px; background-color: ${EMAIL_BRAND_COLORS.background}; border-radius: 8px;">
      <strong style="color: ${EMAIL_BRAND_COLORS.text}; font-size: 14px;">Notes:</strong><br>
      <div style="white-space: pre-wrap; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6; margin-top: 8px;">${invoice.notes}</div>
    </div>
    ` : ''}

    ${invoice.terms ? `
    <div style="margin-bottom: 20px; padding: 16px; background-color: ${EMAIL_BRAND_COLORS.background}; border-radius: 8px;">
      <strong style="color: ${EMAIL_BRAND_COLORS.text}; font-size: 14px;">Terms:</strong><br>
      <div style="white-space: pre-wrap; color: ${EMAIL_BRAND_COLORS.text}; font-size: 16px; line-height: 1.6; margin-top: 8px;">${invoice.terms}</div>
    </div>
    ` : ''}

    <div style="text-align: center; margin-top: 32px;">
      <a href="${invoiceUrl}" style="display: inline-block; background-color: ${EMAIL_BRAND_COLORS.primary}; color: ${EMAIL_BRAND_COLORS.white}; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px;">View Invoice Online</a>
    </div>
  `;

  // Pass organizationId to wrapper so it can fetch the logo
  // The wrapper will prioritize organization logo over app logo
  const html = await generateEmailWrapper({ 
    content, 
    organizationId: organizationId || null,
    preheader: `Invoice ${invoice.invoice_number} from ${orgName}`
  });

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
    const { subject, html, text } = await generateInvoiceEmailTemplate(invoice, organizationBranding, organizationId);

    // Send email with PDF attachment if provided
    if (pdfBuffer) {
      // Note: sendEmail doesn't support attachments directly
      // We'll need to use SendGrid API directly for attachments
      // For now, send without attachment and include link to PDF
      logger.info('PDF attachment not yet supported, sending email without attachment');
    }

    const result = await sendEmailWithRetry(recipientEmail, subject, html, text, undefined, undefined, organizationId);

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

