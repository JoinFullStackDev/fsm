import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { InvoiceWithRelations } from '@/types/ops';

interface InvoicePDFConfig {
  invoice: InvoiceWithRelations;
  organizationBranding?: {
    logo_url?: string | null;
    icon_url?: string | null;
    name?: string;
  };
}

/**
 * Generate branded PDF invoice
 */
export async function generateInvoicePDF(config: InvoicePDFConfig): Promise<Buffer> {
  const { invoice, organizationBranding } = config;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Colors matching app theme
  const primaryColor = [0, 229, 255]; // #C9354A
  const textColor = [51, 51, 51]; // Dark text
  const lightGray = [240, 240, 240];
  const darkGray = [128, 128, 128];

  // Helper function to add new page if needed
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.35); // Approximate line height
  };

  // Header with logo (if available)
  const orgName = organizationBranding?.name || 'Your Organization';
  const logoUrl = organizationBranding?.logo_url || organizationBranding?.icon_url;

  // Note: jsPDF doesn't support loading external images directly
  // In production, you'd need to fetch and convert the image to base64
  // For now, we'll just use text header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(orgName, margin, yPosition);
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('INVOICE', margin, yPosition);
  yPosition += 15;

  // Invoice number and dates
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(`Invoice #${invoice.invoice_number}`, pageWidth - margin - 50, margin + 5);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  const issueDate = format(new Date(invoice.issue_date), 'MMM d, yyyy');
  doc.text(`Issue Date: ${issueDate}`, pageWidth - margin - 50, margin + 12);
  
  if (invoice.due_date) {
    const dueDate = format(new Date(invoice.due_date), 'MMM d, yyyy');
    doc.text(`Due Date: ${dueDate}`, pageWidth - margin - 50, margin + 18);
  }

  yPosition = margin + 35;

  // Bill To section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Bill To:', margin, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.client_name, margin, yPosition);
  yPosition += 5;

  if (invoice.client_email) {
    doc.text(invoice.client_email, margin, yPosition);
    yPosition += 5;
  }

  if (invoice.client_address) {
    const addressParts = [
      invoice.client_address.street,
      invoice.client_address.city,
      invoice.client_address.state,
      invoice.client_address.zip,
    ].filter(Boolean);

    if (addressParts.length > 0) {
      doc.text(addressParts.join(', '), margin, yPosition);
      yPosition += 5;
    }

    if (invoice.client_address.country) {
      doc.text(invoice.client_address.country, margin, yPosition);
      yPosition += 5;
    }
  }

  yPosition += 10;
  checkNewPage(50);

  // Line items table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Items', margin, yPosition);
  yPosition += 8;

  // Table header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, yPosition - 5, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 2, yPosition);
  doc.text('Qty', margin + 80, yPosition);
  doc.text('Unit Price', margin + 100, yPosition);
  doc.text('Amount', pageWidth - margin - 30, yPosition);
  yPosition += 8;

  // Table rows
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'normal');

  if (invoice.line_items && invoice.line_items.length > 0) {
    for (const item of invoice.line_items) {
      checkNewPage(15);

      // Alternating row background
      const rowIndex = invoice.line_items.indexOf(item);
      if (rowIndex % 2 === 0) {
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.rect(margin, yPosition - 5, contentWidth, 8, 'F');
      }

      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      const descLines = doc.splitTextToSize(item.description, 70);
      doc.text(descLines, margin + 2, yPosition);
      
      const descHeight = descLines.length * 3.5;
      doc.text(item.quantity.toString(), margin + 80, yPosition);
      doc.text(`$${item.unit_price.toFixed(2)}`, margin + 100, yPosition);
      doc.text(`$${item.amount.toFixed(2)}`, pageWidth - margin - 30, yPosition);
      
      yPosition += Math.max(descHeight, 8);
    }
  }

  yPosition += 5;
  checkNewPage(30);

  // Totals section
  const totalsX = pageWidth - margin - 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  
  doc.text('Subtotal:', totalsX, yPosition);
  doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
  yPosition += 7;

  if (invoice.tax_rate > 0) {
    doc.text(`Tax (${invoice.tax_rate}%):`, totalsX, yPosition);
    doc.text(`$${invoice.tax_amount.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 7;
  }

  // Total line
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Total:', totalsX, yPosition);
  doc.text(`$${invoice.total_amount.toFixed(2)} ${invoice.currency}`, pageWidth - margin - 2, yPosition, { align: 'right' });
  yPosition += 15;

  checkNewPage(40);

  // Notes and Terms
  if (invoice.notes) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('Notes:', margin, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const notesHeight = addWrappedText(invoice.notes, margin, yPosition, contentWidth);
    yPosition += notesHeight + 10;
    checkNewPage(30);
  }

  if (invoice.terms) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('Terms:', margin, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const termsHeight = addWrappedText(invoice.terms, margin, yPosition, contentWidth);
    yPosition += termsHeight + 10;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      `Generated on ${format(new Date(), 'MMM d, yyyy')}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Convert to buffer
  const pdfBlob = doc.output('blob');
  const arrayBuffer = await pdfBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

