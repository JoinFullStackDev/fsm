import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasCustomDashboards } from '@/lib/packageLimits';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import logger from '@/lib/utils/logger';
import * as metricQueries from '@/lib/dashboards/widgetData/metricQueries';
import * as chartQueries from '@/lib/dashboards/widgetData/chartQueries';
import * as tableQueries from '@/lib/dashboards/widgetData/tableQueries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboards/[id]/export/pdf
 * Export a dashboard as PDF
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to export dashboards');
    }

    // Get user record
    let userData;
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', authUser.id)
        .single();

      if (adminUserError || !adminUserData) {
        return notFound('User record not found');
      }
      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    const organizationId = userData.organization_id;
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check module access
    const hasAccess = await hasCustomDashboards(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Custom dashboards are not enabled for your organization');
    }

    // Get dashboard with widgets
    const { data: dashboard, error: dashboardError } = await supabase
      .from('dashboards')
      .select('*, widgets:dashboard_widgets(*)')
      .eq('id', params.id)
      .single();

    if (dashboardError || !dashboard) {
      return notFound('Dashboard not found');
    }

    // Get organization data for branding
    const adminClient = createAdminSupabaseClient();
    const { data: organization } = await adminClient
      .from('organizations')
      .select('id, name, logo_url')
      .eq('id', organizationId)
      .single();

    // Verify access
    if (dashboard.is_personal) {
      if (dashboard.owner_id !== userData.id) {
        return forbidden('You do not have access to this dashboard');
      }
    } else if (dashboard.organization_id) {
      if (dashboard.organization_id !== organizationId) {
        return forbidden('You do not have access to this dashboard');
      }
    } else if (dashboard.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', dashboard.project_id)
        .single();

      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', dashboard.project_id)
        .eq('user_id', userData.id)
        .single();

      if (project?.owner_id !== userData.id && !member) {
        return forbidden('You do not have access to this dashboard');
      }
    }

    // Generate PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add page numbers function
    const addPageNumbers = () => {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
        doc.setFont('helvetica', 'normal');
        const pageText = `Page ${i} of ${pageCount}`;
        const textWidth = doc.getTextWidth(pageText);
        doc.text(pageText, pageWidth - margin - textWidth, pageHeight - 10);
      }
    };

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Colors - Match app's dark theme but optimized for PDF (white background)
    const primaryTextColor = [0, 0, 0]; // #000 - Black text (for white PDF background)
    const secondaryTextColor = [100, 100, 100]; // Dark gray for secondary text
    const darkBg = [16, 16, 16]; // #101010 - Dark background for header/cards
    const cardBg = [20, 20, 20]; // Dark card background
    const lightBg = [240, 240, 240]; // Light gray for alternating rows
    const dividerColor = [200, 200, 200]; // Gray divider
    const accentColor = [50, 50, 50]; // Dark gray for accents (replaces bright blue)

    // Header with branding - Dark theme
    const headerHeight = 50;
    doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    
    // Add subtle border
    doc.setDrawColor(dividerColor[0], dividerColor[1], dividerColor[2]);
    doc.setLineWidth(0.5);
    doc.line(0, headerHeight, pageWidth, headerHeight);

    // Try to add organization logo
    let logoAdded = false;
    if (organization?.logo_url) {
      try {
        // Fetch logo image
        const logoResponse = await fetch(organization.logo_url);
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const logoArrayBuffer = await logoBlob.arrayBuffer();
          const logoBase64 = Buffer.from(logoArrayBuffer).toString('base64');
          const logoDataUrl = `data:${logoBlob.type};base64,${logoBase64}`;
          
          // Add logo to PDF (max 25mm height, positioned on left)
          // jsPDF will handle aspect ratio automatically if we specify width or height
          const maxLogoHeight = 25;
          const maxLogoWidth = 60;
          
          // Try to get image dimensions from the data URL
          // For now, use a fixed width and let jsPDF scale height proportionally
          doc.addImage(logoDataUrl, 'PNG', margin, 12, maxLogoWidth, maxLogoHeight);
          logoAdded = true;
        }
      } catch (logoError) {
        logger.warn('[PDF Export] Failed to add logo:', logoError);
        // Continue without logo
      }
    }

    // Organization name and dashboard title - White text on dark header
    const textStartX = logoAdded ? margin + 65 : margin;
    
    if (organization?.name && !logoAdded) {
      doc.setTextColor(200, 200, 200); // Light gray on dark background
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(organization.name, textStartX, 20);
    }

    doc.setTextColor(255, 255, 255); // White text on dark header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    const dashboardTitle = dashboard.name.length > 50 
      ? dashboard.name.substring(0, 47) + '...' 
      : dashboard.name;
    doc.text(dashboardTitle, textStartX, logoAdded ? 25 : 28);

    doc.setTextColor(200, 200, 200); // Light gray on dark background
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, textStartX, logoAdded ? 35 : 38);

    // Add a subtle divider line
    doc.setDrawColor(60, 60, 60); // Dark gray for subtle divider on dark background
    doc.setLineWidth(0.3);
    doc.line(margin, headerHeight - 5, pageWidth - margin, headerHeight - 5);

    yPosition = headerHeight + 15;

    // Dashboard description - Dark text on white background
    if (dashboard.description) {
      doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(dashboard.description, contentWidth);
      doc.text(descLines, margin, yPosition);
      yPosition += descLines.length * 5 + 15;
    }

    // Widgets with actual data
    const widgets = (dashboard as any).widgets || [];
    if (widgets.length > 0) {
      // Don't add a section header - widgets will have their own titles

      // Fetch and render each widget's data
      for (const widget of widgets) {
        // Check if we need a new page
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = margin;
        }

        try {
          // Widget title with background
          const widgetTitle = widget.settings?.title || 
            `${widget.widget_type.charAt(0).toUpperCase() + widget.widget_type.slice(1)} Widget`;
          
          // Add background box for widget - dark theme
          const widgetBoxHeight = 8;
          doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
          doc.rect(margin, yPosition - 6, contentWidth, widgetBoxHeight, 'F');
          
          // Add subtle border
          doc.setDrawColor(dividerColor[0], dividerColor[1], dividerColor[2]);
          doc.setLineWidth(0.3);
          doc.rect(margin, yPosition - 6, contentWidth, widgetBoxHeight, 'S');
          
          // Widget title - white text on dark background
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(13);
          doc.setFont('helvetica', 'bold');
          doc.text(widgetTitle, margin + 3, yPosition);
          
          // Widget type badge - darker with white text
          doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
          doc.setTextColor(200, 200, 200);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          const badgeWidth = 25;
          const badgeX = pageWidth - margin - badgeWidth;
          doc.roundedRect(badgeX, yPosition - 5, badgeWidth, 5, 1, 1, 'F');
          doc.text(widget.widget_type.toUpperCase(), badgeX + 2, yPosition - 1.5);
          
          doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]); // Black text for content
          yPosition += 12;

          doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');

          // Fetch and render widget data based on type
          const widgetData = await fetchWidgetDataForPDF(
            supabase,
            organizationId,
            widget,
            userData.id
          );

          yPosition = renderWidgetDataInPDF(doc, widget, widgetData, margin, yPosition, pageHeight, contentWidth, primaryTextColor, secondaryTextColor, accentColor, darkBg, cardBg, lightBg, dividerColor);
          yPosition += 15; // Space between widgets
          
          // Add subtle divider between widgets
          if (yPosition < pageHeight - 30) {
            doc.setDrawColor(dividerColor[0], dividerColor[1], dividerColor[2]);
            doc.setLineWidth(0.3);
            doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
          }
        } catch (error) {
          logger.error(`[PDF Export] Error rendering widget ${widget.id}:`, error);
          doc.setTextColor(200, 0, 0); // Red for errors
          doc.text(`Error loading widget data: ${error instanceof Error ? error.message : 'Unknown error'}`, margin + 5, yPosition);
          yPosition += 8;
        }
      }
    }

    // Add page numbers to all pages
    addPageNumbers();

    // Convert to buffer
    const pdfBlob = doc.output('blob');
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store export record using admin client to bypass RLS
    // (We've already verified user has access to the dashboard)
    try {
      const adminClient = createAdminSupabaseClient();
      const { error: exportError } = await adminClient
        .from('exports')
        .insert({
          project_id: dashboard.project_id || null,
          export_type: 'dashboard_pdf',
          storage_path: `dashboards/${params.id}/${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        });

      if (exportError) {
        logger.error('[Dashboards API] Error storing export record:', exportError);
        // Continue anyway - PDF is generated
      }
    } catch (exportErr) {
      logger.error('[Dashboards API] Error storing export:', exportErr);
      // Continue anyway
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${dashboard.name.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf"`,
      },
    });
  } catch (error) {
    logger.error('[Dashboards API] Error in POST export PDF:', error);
    return internalError('Failed to export dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Fetch widget data for PDF export
 */
async function fetchWidgetDataForPDF(
  supabase: any,
  organizationId: string,
  widget: any,
  userId: string
): Promise<any> {
  const dataset = widget.dataset || {};
  const dataSource = dataset.dataSource || dataset.source;
  const dataSources = dataset.dataSources;

  switch (widget.widget_type) {
    case 'metric':
      if (!dataSource) return null;
      return await fetchMetricDataForPDF(supabase, organizationId, dataSource, dataset, userId);
    
    case 'chart':
      if (!dataSource && (!dataSources || dataSources.length === 0)) return null;
      const chartOptions = {
        projectId: dataset.filters?.projectId,
        dateRange: dataset.filters?.dateRange,
        groupBy: dataset.groupBy || 'day',
      };
      // For PDF, use first data source if multiple
      const chartDataSource = dataSources && dataSources.length > 0 ? dataSources[0] : dataSource;
      return await fetchChartDataForPDF(supabase, organizationId, chartDataSource, chartOptions);
    
    case 'table':
      if (!dataSource) return null;
      return await fetchTableDataForPDF(supabase, organizationId, dataSource, dataset);
    
    case 'ai_insight':
      // Return cached insight if available
      return {
        type: 'ai_insight',
        insight: widget.settings?.cachedInsight || 'No insight generated yet.',
        insight_type: dataset.insight_type || 'project_health',
      };
    
    case 'rich_text':
      return {
        type: 'rich_text',
        content: dataset.content || '',
      };
    
    default:
      return null;
  }
}

/**
 * Fetch metric data for PDF
 */
async function fetchMetricDataForPDF(
  supabase: any,
  organizationId: string,
  dataSource: string,
  dataset: any,
  userId: string
) {
  switch (dataSource) {
    case 'task_count':
      return await metricQueries.getTaskCount(supabase, organizationId, { projectId: dataset.filters?.projectId });
    case 'project_count':
      return await metricQueries.getProjectCount(supabase, organizationId);
    case 'tasks_due_today':
      return await metricQueries.getTasksDueToday(supabase, organizationId, userId);
    case 'overdue_tasks':
      return await metricQueries.getOverdueTasks(supabase, organizationId, userId);
    case 'phase_completion':
      return await metricQueries.getPhaseCompletion(supabase, organizationId, dataset.filters?.projectId);
    case 'ai_tokens_used':
      return await metricQueries.getAITokensUsed(supabase, organizationId, dataset.filters?.dateRange);
    case 'export_count':
      return await metricQueries.getExportCount(supabase, organizationId, dataset.filters?.dateRange);
    case 'user_count':
      return await metricQueries.getUserCount(supabase, organizationId);
    case 'opportunity_count':
      return await metricQueries.getOpportunityCount(supabase, organizationId);
    case 'company_count':
      return await metricQueries.getCompanyCount(supabase, organizationId);
    default:
      return { value: 0, label: 'Unknown metric' };
  }
}

/**
 * Fetch chart data for PDF
 */
async function fetchChartDataForPDF(
  supabase: any,
  organizationId: string,
  dataSource: string,
  options: any
) {
  try {
    switch (dataSource) {
      case 'task_timeline':
        return await chartQueries.getTaskTimeline(supabase, organizationId, options);
      case 'phase_completion_timeline':
        return await chartQueries.getPhaseCompletionTimeline(supabase, organizationId, options);
      case 'task_status_distribution':
        return await chartQueries.getTaskStatusDistribution(supabase, organizationId, { projectId: options.projectId });
      case 'task_priority_distribution':
        return await chartQueries.getTaskPriorityDistribution(supabase, organizationId, { projectId: options.projectId });
      case 'phase_status_distribution':
        return await chartQueries.getPhaseStatusDistribution(supabase, organizationId, { projectId: options.projectId });
      case 'ai_usage_timeline':
        return await chartQueries.getAIUsageTimeline(supabase, organizationId, options);
      case 'export_timeline':
        return await chartQueries.getExportTimeline(supabase, organizationId, options);
      default:
        return { data: [] };
    }
  } catch (error) {
    logger.error(`[PDF Export] Error fetching chart data ${dataSource}:`, error);
    return { data: [] };
  }
}

/**
 * Fetch table data for PDF
 */
async function fetchTableDataForPDF(
  supabase: any,
  organizationId: string,
  dataSource: string,
  dataset: any
) {
  const options = {
    projectId: dataset.filters?.projectId,
    limit: dataset.limit || 10,
    status: dataset.filters?.status,
    assigneeId: dataset.filters?.assigneeId,
    orderBy: dataset.orderBy,
    orderDirection: dataset.orderDirection,
  };

  switch (dataSource) {
    case 'tasks':
      return await tableQueries.getTasksTable(supabase, organizationId, options);
    case 'projects':
      return await tableQueries.getProjectsTable(supabase, organizationId, options);
    case 'opportunities':
      return await tableQueries.getOpportunitiesTable(supabase, organizationId, options);
    case 'companies':
      return await tableQueries.getCompaniesTable(supabase, organizationId, options);
    case 'recent_activity':
      return await tableQueries.getRecentActivityTable(supabase, organizationId, options);
    default:
      return { columns: [], rows: [] };
  }
}

/**
 * Render widget data in PDF
 */
function renderWidgetDataInPDF(
  doc: jsPDF,
  widget: any,
  widgetData: any,
  margin: number,
  yPosition: number,
  pageHeight: number,
  contentWidth: number,
  primaryTextColor: number[],
  secondaryTextColor: number[],
  accentColor: number[],
  darkBg: number[],
  cardBg: number[],
  lightBg: number[],
  dividerColor: number[]
): number {
  let currentY = yPosition;

  if (!widgetData) {
    doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
    doc.text('No data available', margin + 5, currentY);
    return currentY + 7;
  }

  doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);

  switch (widget.widget_type) {
    case 'metric':
      if (widgetData.value !== undefined) {
        const valueText = typeof widgetData.value === 'number' 
          ? widgetData.value.toLocaleString() 
          : String(widgetData.value);
        const labelText = widgetData.label || 'Value';
        
        // Large metric value - white
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
        doc.text(valueText, margin + 5, currentY);
        
        // Label - gray
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
        doc.text(labelText, margin + 5, currentY + 8);
        
        // Change indicator - subtle gray
        if (widgetData.change !== undefined) {
          const changeText = `${widgetData.change >= 0 ? '+' : ''}${widgetData.change}%`;
          doc.setFontSize(9);
          doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
          doc.text(changeText, margin + 5, currentY + 13);
        }
        currentY += 18;
      }
      break;

    case 'chart':
      if (widgetData.data && Array.isArray(widgetData.data) && widgetData.data.length > 0) {
        doc.setFontSize(9);
        // Render chart data as a styled table - dark theme
        const maxRows = Math.min(15, widgetData.data.length); // Show more rows
        const colWidth = contentWidth / 2;
        const rowHeight = 6;
        
        // Table header with dark background
        doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
        doc.rect(margin + 5, currentY - 4, contentWidth - 10, rowHeight, 'F');
        doc.setDrawColor(dividerColor[0], dividerColor[1], dividerColor[2]);
        doc.setLineWidth(0.3);
        doc.rect(margin + 5, currentY - 4, contentWidth - 10, rowHeight, 'S');
        doc.setTextColor(255, 255, 255); // White text on dark header
        doc.setFont('helvetica', 'bold');
        doc.text('Name', margin + 8, currentY);
        doc.text('Value', margin + 8 + colWidth, currentY);
        currentY += rowHeight + 2;
        
        // Table rows with alternating background
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]); // Black text
        for (let i = 0; i < maxRows; i++) {
          if (currentY > pageHeight - 20) {
            doc.addPage();
            currentY = margin;
          }
          
          // Alternating row background - very subtle
          if (i % 2 === 0) {
            doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
            doc.rect(margin + 5, currentY - 4, contentWidth - 10, rowHeight, 'F');
          }
          
          const item = widgetData.data[i];
          const name = item.name || String(i + 1);
          const value = item.value !== undefined ? String(item.value) : '-';
          
          doc.text(name.substring(0, 35), margin + 8, currentY);
          doc.text(value, margin + 8 + colWidth, currentY);
          currentY += rowHeight;
        }
        
        if (widgetData.data.length > maxRows) {
          doc.setFontSize(8);
          doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
          doc.text(`... and ${widgetData.data.length - maxRows} more entries`, margin + 8, currentY);
          currentY += 5;
        }
        currentY += 3; // Extra spacing
      } else {
        doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
        doc.text('No chart data available', margin + 5, currentY);
        currentY += 7;
      }
      break;

    case 'table':
      if (widgetData.columns && widgetData.rows && widgetData.rows.length > 0) {
        doc.setFontSize(8);
        const maxRows = Math.min(15, widgetData.rows.length);
        const colCount = Math.min(4, widgetData.columns.length); // Show more columns
        const colWidth = (contentWidth - 10) / colCount;
        const rowHeight = 5;
        
        // Table header with dark background
        doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
        doc.rect(margin + 5, currentY - 4, contentWidth - 10, rowHeight + 2, 'F');
        doc.setDrawColor(dividerColor[0], dividerColor[1], dividerColor[2]);
        doc.setLineWidth(0.3);
        doc.rect(margin + 5, currentY - 4, contentWidth - 10, rowHeight + 2, 'S');
        doc.setTextColor(255, 255, 255); // White text on dark header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        for (let i = 0; i < colCount; i++) {
          const colName = widgetData.columns[i]?.substring(0, 18) || '';
          doc.text(colName, margin + 8 + (i * colWidth), currentY);
        }
        currentY += rowHeight + 4;
        
        // Table rows with alternating background
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
        for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
          if (currentY > pageHeight - 20) {
            doc.addPage();
            currentY = margin;
          }
          
          // Alternating row background - very subtle
          if (rowIdx % 2 === 0) {
            doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
            doc.rect(margin + 5, currentY - 4, contentWidth - 10, rowHeight, 'F');
          }
          
          const row = widgetData.rows[rowIdx];
          for (let colIdx = 0; colIdx < colCount; colIdx++) {
            const colName = widgetData.columns[colIdx];
            const cellValue = row[colName] !== undefined ? String(row[colName]).substring(0, 18) : '-';
            doc.text(cellValue, margin + 8 + (colIdx * colWidth), currentY);
          }
          currentY += rowHeight;
        }
        
        if (widgetData.rows.length > maxRows) {
          doc.setFontSize(8);
          doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
          doc.text(`... and ${widgetData.rows.length - maxRows} more rows`, margin + 8, currentY);
          currentY += 5;
        }
        currentY += 3; // Extra spacing
      } else {
        doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
        doc.text('No table data available', margin + 5, currentY);
        currentY += 7;
      }
      break;

    case 'ai_insight':
      if (widgetData.insight) {
        doc.setFontSize(9);
        doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
        const insightLines = doc.splitTextToSize(widgetData.insight, contentWidth - 10);
        doc.text(insightLines, margin + 5, currentY);
        currentY += insightLines.length * 4;
      } else {
        doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
        doc.text('No insight generated yet', margin + 5, currentY);
        currentY += 7;
      }
      break;

    case 'rich_text':
      if (widgetData.content) {
        doc.setFontSize(9);
        doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
        // Remove markdown formatting for PDF
        const plainText = widgetData.content
          .replace(/#{1,6}\s+/g, '') // Remove headers
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.*?)\*/g, '$1') // Remove italic
          .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Remove links
        
        const contentLines = doc.splitTextToSize(plainText, contentWidth - 10);
        doc.text(contentLines, margin + 5, currentY);
        currentY += contentLines.length * 4;
      } else {
        doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
        doc.text('No content', margin + 5, currentY);
        currentY += 7;
      }
      break;

    default:
      doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
      doc.text(`Widget type: ${widget.widget_type}`, margin + 5, currentY);
      currentY += 7;
  }

  return currentY;
}

