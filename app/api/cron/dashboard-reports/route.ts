import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import { sendEmail } from '@/lib/emailService';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/dashboard-reports
 * Cron endpoint to send scheduled dashboard reports
 * Should be called by Vercel Cron or external cron service
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if provided
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return unauthorized('Invalid cron secret');
    }

    const adminClient = createAdminSupabaseClient();
    const now = new Date();

    // Get all enabled subscriptions that are due
    const { data: subscriptions, error: subscriptionsError } = await adminClient
      .from('dashboard_subscriptions')
      .select('*, dashboard:dashboards(*, organization_id), user:users(email, name, organization_id)')
      .eq('enabled', true);

    if (subscriptionsError) {
      logger.error('[Cron Dashboard Reports] Error fetching subscriptions:', subscriptionsError);
      return internalError('Failed to fetch subscriptions');
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions to process', processed: 0 });
    }

    let processed = 0;
    let errors = 0;

    for (const subscription of subscriptions) {
      try {
        const dashboard = (subscription as any).dashboard;
        const user = (subscription as any).user;

        if (!dashboard || !user) {
          logger.warn('[Cron Dashboard Reports] Missing dashboard or user for subscription:', subscription.id);
          continue;
        }

        // Check if subscription is due based on schedule_type
        const lastSent = subscription.last_sent_at ? new Date(subscription.last_sent_at) : null;
        let shouldSend = false;

        if (subscription.schedule_type === 'daily') {
          // Send if never sent or last sent more than 24 hours ago
          shouldSend = !lastSent || (now.getTime() - lastSent.getTime()) > 24 * 60 * 60 * 1000;
        } else if (subscription.schedule_type === 'weekly') {
          // Send if never sent or last sent more than 7 days ago
          shouldSend = !lastSent || (now.getTime() - lastSent.getTime()) > 7 * 24 * 60 * 60 * 1000;
        } else if (subscription.schedule_type === 'monthly') {
          // Send if never sent or last sent more than 30 days ago
          shouldSend = !lastSent || (now.getTime() - lastSent.getTime()) > 30 * 24 * 60 * 60 * 1000;
        }

        if (!shouldSend) {
          continue;
        }

        // Generate PDF
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPosition = margin;

        // Header
        doc.setFillColor(18, 22, 51);
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setTextColor(0, 229, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(dashboard.name, margin, 20);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Scheduled Dashboard Report', margin, 30);
        doc.text(`Generated: ${format(now, 'MMM d, yyyy')}`, margin, 35);

        yPosition = 50;

        if (dashboard.description) {
          doc.setTextColor(33, 33, 33);
          doc.setFontSize(10);
          const descLines = doc.splitTextToSize(dashboard.description, pageWidth - 2 * margin);
          doc.text(descLines, margin, yPosition);
          yPosition += descLines.length * 5 + 10;
        }

        // Get widgets
        const { data: widgets } = await adminClient
          .from('dashboard_widgets')
          .select('*')
          .eq('dashboard_id', dashboard.id);

        if (widgets && widgets.length > 0) {
          doc.setTextColor(0, 229, 255);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Widgets', margin, yPosition);
          yPosition += 10;

          doc.setTextColor(33, 33, 33);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');

          interface WidgetRow { widget_type: string; id: string; }
          (widgets as WidgetRow[]).forEach((widget) => {
            if (yPosition > doc.internal.pageSize.getHeight() - 30) {
              doc.addPage();
              yPosition = margin;
            }

            doc.text(`• ${widget.widget_type}`, margin + 5, yPosition);
            yPosition += 7;
          });
        }

        const pdfBlob = doc.output('blob');
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        // Convert to base64 for email attachment
        const pdfBase64 = pdfBuffer.toString('base64');

        // Get organization ID from dashboard or user
        const organizationId = (dashboard as { organization_id?: string }).organization_id || (user as { organization_id?: string }).organization_id || null;

        // Send email
        const emailHtml = `
          <h2>Dashboard Report: ${dashboard.name}</h2>
          <p>Your scheduled dashboard report is attached.</p>
          <p>Schedule: ${subscription.schedule_type}</p>
          <p>Generated: ${format(now, 'MMM d, yyyy h:mm a')}</p>
        `;

        // Note: SendGrid attachment support would need to be implemented
        // For now, we'll send the email without attachment
        const emailResult = await sendEmail(
          subscription.email,
          `Dashboard Report: ${dashboard.name}`,
          emailHtml,
          undefined,
          undefined,
          organizationId || undefined
        );

        if (!emailResult.success) {
          logger.error('[Cron Dashboard Reports] Error sending email:', emailResult.error);
          errors++;
          continue;
        }

        // Update last_sent_at
        await adminClient
          .from('dashboard_subscriptions')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', subscription.id);

        processed++;
      } catch (error) {
        logger.error('[Cron Dashboard Reports] Error processing subscription:', {
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        errors++;
      }
    }

    return NextResponse.json({
      message: 'Dashboard reports processed',
      processed,
      errors,
      total: subscriptions.length,
    });
  } catch (error) {
    logger.error('[Cron Dashboard Reports] Error in cron job:', error);
    return internalError('Failed to process dashboard reports', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

