import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId, getOrganizationPackageFeatures } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { canCreateTemplate } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view templates');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, authUser.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record with role and super admin status
    // Use admin client to avoid RLS recursion issues
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      logger.error('[Templates API] User not found:', userError);
      return notFound('User not found');
    }

    // Check if organization has template access based on package features
    // If max_templates is defined (null = unlimited, number = limited), they have access to view
    // undefined means no access, null means unlimited, number means limited
    const packageFeatures = await getOrganizationPackageFeatures(supabase, organizationId);
    
    logger.debug('[Templates API] Package features check:', {
      organizationId,
      hasFeatures: !!packageFeatures,
      maxTemplates: packageFeatures?.max_templates,
      packageName: packageFeatures ? 'unknown' : 'none',
    });
    
    if (!packageFeatures) {
      logger.error('[Templates API] No package features found - RLS or subscription issue:', {
        organizationId,
        userId: userData.id,
      });
      return forbidden('Template access not available - unable to load package features. Please contact support.');
    }
    
    if (packageFeatures.max_templates === undefined) {
      logger.warn('[Templates API] Template access denied - max_templates is undefined:', {
        organizationId,
        packageFeatures: Object.keys(packageFeatures),
      });
      return forbidden('Template access not available in your package');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Filter by organization and visibility (super admins can see all templates)
    // Use admin client to avoid RLS recursion issues
    let templates: any[] = [];
    let count = 0;

    if (userData.role === 'admin' && userData.is_super_admin === true) {
      // Super admin can see all templates
      const { data: allTemplates, error: allError, count: allCount } = await adminClient
        .from('project_templates')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (allError) {
        logger.error('Error loading templates:', allError);
        return internalError('Failed to load templates', { error: allError.message });
      }

      templates = allTemplates || [];
      count = allCount || 0;
    } else {
      // Regular users see templates that match:
      // 1. Templates from their organization where (is_public = true OR created_by = current user)
      // 2. OR templates where is_publicly_available = true (from any organization)
      
      // Fetch organization templates (public or created by user)
      const { data: orgTemplates, error: orgError } = await adminClient
        .from('project_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .or(`is_public.eq.true,created_by.eq.${userData.id}`);

      // Fetch publicly available templates
      const { data: publicTemplates, error: publicError } = await adminClient
        .from('project_templates')
        .select('*')
        .eq('is_publicly_available', true);

      if (orgError || publicError) {
        logger.error('Error loading templates:', orgError || publicError);
        return internalError('Failed to load templates', { error: (orgError || publicError)?.message });
      }

      // Combine and deduplicate templates
      const allTemplates = [...(orgTemplates || []), ...(publicTemplates || [])];
      const uniqueTemplates = Array.from(
        new Map(allTemplates.map(t => [t.id, t])).values()
      );

      // Sort by created_at descending
      uniqueTemplates.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      count = uniqueTemplates.length;
      
      // Apply pagination
      templates = uniqueTemplates.slice(offset, offset + limit);
    }

    const templatesError = null;

    // Get usage counts for each template
    // Use admin client to avoid RLS recursion
    const templatesWithUsage = await Promise.all(
      templates.map(async (template) => {
        const { count: usageCount, error: countError } = await adminClient
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

    const response = NextResponse.json({
      data: templatesWithUsage,
      total: count || 0,
      limit,
      offset,
    });
    response.headers.set('Cache-Control', 'private, max-age=30'); // 30 second cache for templates
    return response;
  } catch (error) {
    logger.error('Error in GET /api/admin/templates:', error);
    return internalError('Failed to load templates', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create templates');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, session.user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record with role - use admin client to ensure we get it
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Template POST] User not found:', userError);
      return notFound('User not found');
    }

    // Check package limits - this determines if user can create templates
    const limitCheck = await canCreateTemplate(supabase, organizationId);
    if (!limitCheck.allowed) {
      return forbidden(limitCheck.reason || 'Template limit reached');
    }

    const body = await request.json();
    const { name, description, is_public, is_publicly_available, category } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Template name is required');
    }

    // Create template with organization_id - use admin client to bypass RLS
    const { data: newTemplate, error: createError } = await adminClient
      .from('project_templates')
      .insert({
        name: name.trim(),
        description: description ? description.trim() : null,
        created_by: userData.id,
        organization_id: organizationId,
        is_public: is_public || false,
        is_publicly_available: is_publicly_available || false,
        category: category || null,
      })
      .select()
      .single();

    if (createError) {
      logger.error('[Template POST] Error creating template:', createError);
      return internalError('Failed to create template', { error: createError.message });
    }

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/admin/templates:', error);
    return internalError('Failed to create template', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

