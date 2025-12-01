import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasKnowledgeBaseAccess } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/articles/[id]/versions
 * Get version history for an article
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view version history');
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
        return unauthorized('Knowledge base is not enabled for your organization');
      }
    }

    // Get article to verify it exists
    const { data: article, error: articleError } = await supabase
      .from('knowledge_base_articles')
      .select('organization_id, published')
      .eq('id', params.id)
      .single();

    if (articleError || !article) {
      return notFound('Article not found');
    }

    // Check access
    const isAdminOrPM = userData.role === 'admin' || userData.role === 'pm';
    if (!article.published && !isAdminOrPM) {
      return notFound('Article not found');
    }

    // Get versions
    const { data: versions, error: versionsError } = await supabase
      .from('knowledge_base_versions')
      .select('*')
      .eq('article_id', params.id)
      .order('version_number', { ascending: false });

    if (versionsError) {
      logger.error('[KB Versions API] Error fetching versions:', versionsError);
      return internalError('Failed to fetch versions', { error: versionsError.message });
    }

    return NextResponse.json({
      versions: versions || [],
    });
  } catch (error) {
    logger.error('[KB Versions API] Exception in GET:', error);
    return internalError('Failed to fetch versions');
  }
}

