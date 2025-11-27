import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { notifyProjectCreated } from '@/lib/notifications';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, validateOrganizationAccess } from '@/lib/organizationContext';
import { canCreateProject } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to view projects');
    }

    // Get user record with role and organization
    // Try regular client first, fall back to admin client if RLS blocks
    let userData;
    let userError;
    
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      // RLS might be blocking - try admin client
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, role, organization_id, is_super_admin')
        .eq('auth_id', authUser.id)
        .single();

      if (adminUserError || !adminUserData) {
        logger.error('[Projects API] User record not found:', { 
          authId: authUser.id, 
          email: authUser.email,
          regularError: regularUserError,
          adminError: adminUserError 
        });
        return notFound('User record not found. Please try signing out and signing in again.');
      }

      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    // Get user's organization ID
    const organizationId = userData.organization_id;
    if (!organizationId) {
      logger.warn('[Projects API] User missing organization_id:', { userId: userData.id, authId: authUser.id });
      return badRequest('User is not assigned to an organization. Please contact support.');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query with company join
    let query = supabase
      .from('projects')
      .select(`
        *,
        company:companies(id, name)
      `, { count: 'exact' });

    // Super admins can see all projects, otherwise filter by organization
    if (userData.role === 'admin' && userData.is_super_admin === true) {
      // Super admin can see all projects
      // Still filter by company_id if provided
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
    } else {
      // Regular users: filter by organization_id
      query = query.eq('organization_id', organizationId);
      
      // Get project IDs where user is a member (within their organization)
      const { data: memberProjects, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userData.id);

      if (memberError) {
        logger.error('Error loading project members:', memberError);
        return internalError('Failed to load project members', { error: memberError.message });
      }

      const memberProjectIds = (memberProjects || []).map((mp: any) => mp.project_id);
      
      // Build OR condition: owner_id matches OR id is in member project IDs
      // Note: organization_id filter already applied above
      if (memberProjectIds.length > 0) {
        query = query.or(`owner_id.eq.${userData.id},id.in.(${memberProjectIds.join(',')})`);
      } else {
        // If user is not a member of any projects, only show owned projects
        query = query.eq('owner_id', userData.id);
      }
      
      // Filter by company_id if provided (within organization)
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
    }

    query = query.order('updated_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: projects, error: projectsError, count } = await query;

    if (projectsError) {
      logger.error('Error loading projects:', projectsError);
      return internalError('Failed to load projects', { error: projectsError.message });
    }

    return NextResponse.json({
      data: projects || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error in GET /api/projects:', error);
    return internalError('Failed to load projects', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return unauthorized('You must be logged in to create projects');
    }

    const body = await request.json();
    const { name, description, status, primary_tool, company_id } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Project name is required');
    }

    // Get user record with organization - try regular client first, fall back to admin client if RLS blocks
    let userData;
    
    const { data: regularUserData, error: regularUserError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single();

    if (regularUserError || !regularUserData) {
      // RLS might be blocking - try admin client
      const adminClient = createAdminSupabaseClient();
      const { data: adminUserData, error: adminUserError } = await adminClient
        .from('users')
        .select('id, organization_id')
        .eq('auth_id', authUser.id)
        .single();

      if (adminUserError || !adminUserData) {
        logger.error('[Projects API POST] User record not found:', { 
          authId: authUser.id, 
          email: authUser.email,
          regularError: regularUserError,
          adminError: adminUserError 
        });
        return notFound('User record not found. Please try signing out and signing in again.');
      }

      userData = adminUserData;
    } else {
      userData = regularUserData;
    }

    const organizationId = userData.organization_id;
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check package limits before creating project
    const limitCheck = await canCreateProject(supabase, organizationId);
    if (!limitCheck.allowed) {
      return forbidden(limitCheck.reason || 'Project limit reached');
    }

    // Verify company exists if company_id is provided (and belongs to organization)
    if (company_id) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, organization_id')
        .eq('id', company_id)
        .single();

      if (companyError || !company) {
        if (companyError?.code === 'PGRST116') {
          return badRequest('Company not found');
        }
        logger.error('Error checking company:', companyError);
        return internalError('Failed to check company', { error: companyError?.message });
      }

      // Verify company belongs to user's organization
      if (company.organization_id !== organizationId) {
        return forbidden('Company does not belong to your organization');
      }
    }

    // Create project with organization_id
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        owner_id: userData.id,
        organization_id: organizationId,
        name,
        description,
        status: status || 'idea',
        primary_tool: primary_tool || null,
        company_id: company_id || null,
        source: 'Manual', // Default for manually created projects
      })
      .select()
      .single();

    if (projectError) {
      logger.error('Error creating project:', projectError);
      return internalError('Failed to create project', { error: projectError.message });
    }

    // Create notification for project owner if different from creator
    if (project.owner_id && project.owner_id !== userData.id) {
      const { data: creator } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.id)
        .single();

      notifyProjectCreated(
        project.owner_id,
        userData.id,
        project.id,
        project.name,
        creator?.name || null
      ).catch((err) => {
        logger.error('[Project] Error creating notification:', err);
      });
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/projects:', error);
    return internalError('Failed to create project', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

