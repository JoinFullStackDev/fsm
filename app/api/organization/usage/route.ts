import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organization/usage
 * Get organization usage counts (projects, users, templates)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return NextResponse.json({ projects: 0, users: 0, templates: 0 });
    }

    // Use admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    
    const [projectsResult, usersResult, templatesResult] = await Promise.all([
      adminClient
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      adminClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      adminClient
        .from('project_templates')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
    ]);

    return NextResponse.json({
      projects: projectsResult.count || 0,
      users: usersResult.count || 0,
      templates: templatesResult.count || 0,
    });
  } catch (error) {
    logger.error('[Organization Usage] Error:', error);
    return internalError('Failed to load organization usage');
  }
}

