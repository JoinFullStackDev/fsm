import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { ReportContent } from './aiReportGenerator';
import type { WeeklyReportData, MonthlyReportData, ForecastReportData } from './dataAggregator';

interface PDFReportConfig {
  projectName: string;
  reportType: 'weekly' | 'monthly' | 'forecast';
  dateRange: string;
  content: ReportContent;
  data: WeeklyReportData | MonthlyReportData | ForecastReportData;
  projectMembers: Array<{ id: string; name: string | null }>;
}

/**
 * Generate PDF report
 */
export function generatePDFReport(config: PDFReportConfig): Blob {
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
  const primaryColor = [0, 229, 255]; // #00E5FF
  const secondaryColor = [233, 30, 99]; // #E91E63
  const textColor = [224, 224, 224]; // #E0E0E0
  const darkBg = [18, 22, 51]; // #000

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

  // Header
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config.projectName, margin, 20);
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const reportTypeLabel = config.reportType.charAt(0).toUpperCase() + config.reportType.slice(1) + ' Report';
  doc.text(reportTypeLabel, margin, 30);
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, margin, 35);
  
  yPosition = 50;

  // Executive Summary
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', margin, yPosition);
  yPosition += 10;

  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryHeight = addWrappedText(config.content.executiveSummary, margin, yPosition, contentWidth);
  yPosition += summaryHeight + 10;

  checkNewPage(30);

  // Key Insights
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Insights', margin, yPosition);
  yPosition += 10;

  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  config.content.keyInsights.forEach((insight) => {
    checkNewPage(10);
    doc.text('•', margin, yPosition);
    const insightHeight = addWrappedText(insight, margin + 5, yPosition, contentWidth - 5);
    yPosition += insightHeight + 5;
  });
  yPosition += 5;

  checkNewPage(30);

  // Metrics Section
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Metrics Overview', margin, yPosition);
  yPosition += 10;

  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  
  if ('metrics' in config.data) {
    const metrics = config.data.metrics;
    doc.text(`Total Tasks: ${metrics.total}`, margin, yPosition);
    yPosition += 7;
    doc.text(`Completed: ${metrics.completed}`, margin, yPosition);
    yPosition += 7;
    doc.text(`In Progress: ${metrics.inProgress}`, margin, yPosition);
    yPosition += 7;
    doc.text(`Todo: ${metrics.todo}`, margin, yPosition);
    yPosition += 7;
    if (metrics.overdue > 0) {
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(`Overdue: ${metrics.overdue}`, margin, yPosition);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      yPosition += 7;
    }
    if (metrics.upcomingDeadlines > 0) {
      doc.text(`Upcoming Deadlines (7 days): ${metrics.upcomingDeadlines}`, margin, yPosition);
      yPosition += 7;
    }
  }
  yPosition += 5;

  checkNewPage(30);

  // Risks
  if (config.content.risks.length > 0) {
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Risks & Concerns', margin, yPosition);
    yPosition += 10;

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    config.content.risks.forEach((risk) => {
      checkNewPage(10);
      doc.text('⚠', margin, yPosition);
      const riskHeight = addWrappedText(risk, margin + 5, yPosition, contentWidth - 5);
      yPosition += riskHeight + 5;
    });
    yPosition += 5;
  }

  checkNewPage(30);

  // Recommendations
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Recommendations', margin, yPosition);
  yPosition += 10;

  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  config.content.recommendations.forEach((rec) => {
    checkNewPage(10);
    doc.text('→', margin, yPosition);
    const recHeight = addWrappedText(rec, margin + 5, yPosition, contentWidth - 5);
    yPosition += recHeight + 5;
  });
  yPosition += 5;

  checkNewPage(20);

  // Team Workload
  if (config.content.teamWorkload) {
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Team Workload Analysis', margin, yPosition);
    yPosition += 10;

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    const workloadHeight = addWrappedText(config.content.teamWorkload, margin, yPosition, contentWidth);
    yPosition += workloadHeight + 10;
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${totalPages} | FullStack Method™ App`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Generate blob
  return doc.output('blob');
}

