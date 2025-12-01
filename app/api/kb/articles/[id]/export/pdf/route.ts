import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasKnowledgeBaseAccess } from '@/lib/packageLimits';
import { generateArticlePDF, markdownToHTML } from '@/lib/kb/export';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/kb/articles/[id]/export/pdf
 * Export article as PDF
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to export articles');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User record not found');
    }

    const organizationId = userData.organization_id;

    // Check KB access
    if (organizationId) {
      const hasAccess = await hasKnowledgeBaseAccess(supabase, organizationId);
      if (!hasAccess) {
        return forbidden('Knowledge base is not enabled for your organization');
      }
    }

    // Get article
    const { data: article, error: articleError } = await supabase
      .from('knowledge_base_articles')
      .select('*')
      .eq('id', params.id)
      .single();

    if (articleError || !article) {
      return notFound('Article not found');
    }

    // Check access (published or admin/PM)
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!article.published && !isAdminOrPM) {
      return notFound('Article not found');
    }

    // Check organization access
    if (article.organization_id !== organizationId) {
      if (article.organization_id !== null || !userData.is_super_admin) {
        return forbidden('You do not have access to this article');
      }
    }

    // Convert markdown to HTML
    const htmlContent = markdownToHTML(article.body);

    // Generate PDF
    const pdfBuffer = await generateArticlePDF(article, htmlContent);

    // Record export
    try {
      const adminClient = createAdminSupabaseClient();
      await adminClient.from('exports').insert({
        project_id: null,
        export_type: 'kb_article_pdf',
        storage_path: `kb/articles/${params.id}/${new Date().toISOString().split('T')[0]}.pdf`,
        user_id: userData.id,
        file_size: pdfBuffer.length,
      });
    } catch (err) {
      logger.error('[KB Export PDF] Error recording export:', err);
      // Don't fail the request if export recording fails
    }

    // Track analytics
    try {
      await supabase.from('knowledge_base_analytics').insert({
        article_id: params.id,
        user_id: userData.id,
        action_type: 'export',
        metadata: {
          export_type: 'pdf',
        },
      });
    } catch (err) {
      logger.error('[KB Export PDF] Error tracking analytics:', err);
    }

    // Return PDF
    const sanitizedTitle = article.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${sanitizedTitle}.pdf"`,
      },
    });
  } catch (error) {
    logger.error('[KB Export PDF] Exception:', error);
    return internalError('Failed to export article as PDF');
  }
}

