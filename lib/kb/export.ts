/**
 * Knowledge Base Export Utilities
 * Handles PDF and ZIP export generation
 */

import JSZip from 'jszip';
import jsPDF from 'jspdf';
import logger from '@/lib/utils/logger';
import type { KnowledgeBaseArticle, KnowledgeBaseCategory } from '@/types/kb';

/**
 * Strip HTML tags and convert to plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

/**
 * Generate PDF from article markdown
 * @param article - Article data
 * @param htmlContent - Rendered HTML content (from markdown)
 * @returns PDF buffer
 */
export async function generateArticlePDF(
  article: KnowledgeBaseArticle,
  htmlContent: string
): Promise<Buffer> {
  try {
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
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10, fontStyle: 'normal' | 'bold' | 'italic' = 'normal') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return lines.length * (fontSize * 0.35); // Approximate line height
    };

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 26, 26);
    const titleLines = doc.splitTextToSize(article.title, contentWidth);
    doc.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 7 + 5;

    // Summary if available
    if (article.summary) {
      checkNewPage(15);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(42, 42, 42);
      doc.text('Summary:', margin, yPosition);
      yPosition += 7;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 51, 51);
      const summaryHeight = addWrappedText(article.summary, margin, yPosition, contentWidth);
      yPosition += summaryHeight + 10;
    }

    // Content - strip HTML and add as text
    checkNewPage(20);
    const plainText = stripHtml(htmlContent);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 51, 51);
    
    // Split content into paragraphs
    const paragraphs = plainText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    for (const para of paragraphs) {
      checkNewPage(15);
      const paraHeight = addWrappedText(para.trim(), margin, yPosition, contentWidth);
      yPosition += paraHeight + 5;
    }

    // Metadata section
    checkNewPage(30);
    yPosition += 5;
    doc.setDrawColor(224, 224, 224);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(102, 102, 102);

    // Tags
    if (article.tags && article.tags.length > 0) {
      const tagsText = `Tags: ${article.tags.join(', ')}`;
      addWrappedText(tagsText, margin, yPosition, contentWidth, 9);
      yPosition += 7;
    }

    // Created date
    const createdDate = new Date(article.created_at).toLocaleDateString();
    addWrappedText(`Created: ${createdDate}`, margin, yPosition, contentWidth, 9);
    yPosition += 7;

    // Reading time
    if (article.metadata?.reading_time) {
      addWrappedText(`Reading Time: ${article.metadata.reading_time} minutes`, margin, yPosition, contentWidth, 9);
      yPosition += 7;
    }

    // Add page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Generate buffer
    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
  } catch (error) {
    logger.error('[KB Export] Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Generate ZIP file containing all articles in a category
 * @param category - Category data
 * @param articles - Articles in the category
 * @param articleContents - Map of article IDs to rendered HTML content
 * @returns ZIP buffer
 */
export async function generateCategoryZIP(
  category: KnowledgeBaseCategory,
  articles: KnowledgeBaseArticle[],
  articleContents: Map<string, string>
): Promise<Buffer> {
  try {
    const zip = new JSZip();

    // Create category folder
    const categoryFolder = zip.folder(category.slug || category.name.toLowerCase().replace(/\s+/g, '-'));

    if (!categoryFolder) {
      throw new Error('Failed to create category folder in ZIP');
    }

    // Add each article as a markdown file
    for (const article of articles) {
      const fileName = `${article.slug || article.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      const content = `# ${article.title}\n\n${article.summary ? `**Summary:** ${article.summary}\n\n` : ''}${article.body}`;
      categoryFolder.file(fileName, content);
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    return zipBuffer;
  } catch (error) {
    logger.error('[KB Export] Error generating ZIP:', error);
    throw new Error('Failed to generate ZIP');
  }
}

/**
 * Convert markdown to HTML (simple implementation)
 * For production, consider using a proper markdown parser like marked or remark
 * @param markdown - Markdown content
 * @returns HTML content
 */
export function markdownToHTML(markdown: string): string {
  // Simple markdown to HTML conversion
  // For production, use a proper library like marked or remark
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/_(.*?)_/gim, '<em>$1</em>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');

  // Lists
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

  // Wrap consecutive list items
  html = html.replace(/(<li>.*<\/li>\n?)+/gim, '<ul>$&</ul>');

  // Paragraphs
  html = html.split('\n\n').map(para => {
    if (!para.trim() || para.startsWith('<')) {
      return para;
    }
    return `<p>${para}</p>`;
  }).join('\n');

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

