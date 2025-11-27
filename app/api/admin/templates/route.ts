import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view templates');
    }

    // Get user record with role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Only admins and PMs can view templates
    if (userData.role !== 'admin' && userData.role !== 'pm') {
      return forbidden('Admin or PM access required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
      .from('project_templates')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: templates, error: templatesError, count } = await query;

    if (templatesError) {
      logger.error('Error loading templates:', templatesError);
      return internalError('Failed to load templates', { error: templatesError.message });
    }

    // Get usage counts for each template
    const templatesWithUsage = await Promise.all(
      (templates || []).map(async (template) => {
        const { count: usageCount, error: countError } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('template_id', template.id);

        if (countError) {
          logger.error('Error counting template usage:', countError);
          return { ...template, usage_count: 0 };
        }

        return { ...template, usage_count: usageCount || 0 };
      })
    );

    return NextResponse.json({
      data: templatesWithUsage,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error in GET /api/admin/templates:', error);
    return internalError('Failed to load templates', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

