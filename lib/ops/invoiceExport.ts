import type { InvoiceWithRelations } from '@/types/ops';

/**
 * Export invoices to CSV format
 */
export function exportInvoicesToCSV(invoices: InvoiceWithRelations[]): string {
  const headers = [
    'Invoice Number',
    'Issue Date',
    'Due Date',
    'Status',
    'Client Name',
    'Client Email',
    'Subtotal',
    'Tax Rate',
    'Tax Amount',
    'Total Amount',
    'Currency',
    'Project',
    'Company',
    'Sent At',
    'Paid At',
  ];

  const rows = invoices.map((invoice) => {
    const paidAt = invoice.payments && invoice.payments.length > 0
      ? invoice.payments[0].payment_date
      : '';

    return [
      invoice.invoice_number,
      invoice.issue_date,
      invoice.due_date || '',
      invoice.status,
      invoice.client_name,
      invoice.client_email || '',
      invoice.subtotal.toString(),
      invoice.tax_rate.toString(),
      invoice.tax_amount.toString(),
      invoice.total_amount.toString(),
      invoice.currency,
      invoice.project?.name || '',
      invoice.company?.name || '',
      invoice.sent_at || '',
      paidAt,
    ];
  });

  // Escape CSV values
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ];

  return csvRows.join('\n');
}

/**
 * Export invoices to QuickBooks IIF format
 * IIF (Intuit Interchange Format) is a tab-delimited format used by QuickBooks
 */
export function exportInvoicesToQuickBooks(invoices: InvoiceWithRelations[]): string {
  // QuickBooks IIF format requires specific headers and structure
  // This is a simplified version - full implementation would need more fields
  
  const lines: string[] = [];
  
  // Header for Invoice transactions
  lines.push('!TRNS	TRNSTYPE	DATE	ACCNT	NAME	AMOUNT	DOCNUM	MEMO	CLEAR	TOPRINT	NAMEISTAXABLE	ADDR1	ADDR2	ADDR3	ADDR4	ADDR5	DUEDATE	TERMS	PAID');
  lines.push('!SPL	TRNSTYPE	DATE	ACCNT	NAME	AMOUNT	DOCNUM	MEMO	CLEAR	QNTY	PRICE	INVITEM	TAXABLE	OTHER2	CLASS	AMOUNT');
  lines.push('!ENDTRNS');

  // Process each invoice
  for (const invoice of invoices) {
    if (invoice.status === 'cancelled') {
      continue; // Skip cancelled invoices
    }

    const invoiceDate = invoice.issue_date.replace(/-/g, '/');
    const dueDate = invoice.due_date ? invoice.due_date.replace(/-/g, '/') : '';
    const amount = invoice.total_amount.toFixed(2);
    const clientName = invoice.client_name.replace(/\t/g, ' '); // Remove tabs from name

    // Invoice header (TRNS)
    const trnsLine = [
      'TRNS',
      'INVOICE',
      invoiceDate,
      'Accounts Receivable', // Default AR account - should be configurable
      clientName,
      amount,
      invoice.invoice_number,
      invoice.notes || '',
      'N',
      'N',
      'N',
      invoice.client_address?.street || '',
      invoice.client_address?.city || '',
      invoice.client_address?.state || '',
      invoice.client_address?.zip || '',
      invoice.client_address?.country || '',
      dueDate,
      '', // Terms
      invoice.status === 'paid' ? 'Y' : 'N',
    ].join('\t');

    lines.push(trnsLine);

    // Line items (SPL)
    if (invoice.line_items && invoice.line_items.length > 0) {
      for (const item of invoice.line_items) {
        const splLine = [
          'SPL',
          'INVOICE',
          invoiceDate,
          'Income', // Default income account - should be configurable
          clientName,
          `-${item.amount.toFixed(2)}`, // Negative for income
          invoice.invoice_number,
          item.description,
          'N',
          item.quantity.toString(),
          item.unit_price.toFixed(2),
          'Service', // Default item type - should be configurable
          'N',
          '',
          '',
          `-${item.amount.toFixed(2)}`,
        ].join('\t');

        lines.push(splLine);
      }
    }

    // Tax line if applicable
    if (invoice.tax_amount > 0) {
      const taxLine = [
        'SPL',
        'INVOICE',
        invoiceDate,
        'Tax', // Default tax account - should be configurable
        clientName,
        `-${invoice.tax_amount.toFixed(2)}`,
        invoice.invoice_number,
        `Tax (${invoice.tax_rate}%)`,
        'N',
        '1',
        invoice.tax_amount.toFixed(2),
        'Tax',
        'N',
        '',
        '',
        `-${invoice.tax_amount.toFixed(2)}`,
      ].join('\t');

      lines.push(taxLine);
    }

    // End transaction
    lines.push('ENDTRNS');
  }

  return lines.join('\n');
}

/**
 * Export invoices to JSON format (for backup/import)
 */
export function exportInvoicesToJSON(invoices: InvoiceWithRelations[]): string {
  return JSON.stringify(invoices, null, 2);
}

