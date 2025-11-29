import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { notifyProjectCreated } from '@/lib/notifications';
import { sendProjectCreatedEmail } from '@/lib/emailNotifications';
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

    // Get user record with organization - always use admin client to ensure we get the data
    const adminClientForUser = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClientForUser
      .from('users')
      .select('id, organization_id, email, name')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      logger.error('[Projects API POST] User record not found:', { 
        authId: authUser.id, 
        email: authUser.email,
        error: userError 
      });
      return notFound('User record not found. Please try signing out and signing in again.');
    }

    const organizationId = userData.organization_id;
    if (!organizationId) {
      logger.error('[Projects API POST] User missing organization_id:', { 
        userId: userData.id, 
        authId: authUser.id,
        email: authUser.email,
        userData: JSON.stringify(userData)
      });
      return badRequest('User is not assigned to an organization');
    }

    // Double-check organizationId is a valid UUID string
    if (typeof organizationId !== 'string' || organizationId.trim() === '') {
      logger.error('[Projects API POST] Invalid organization_id format:', { 
        organizationId,
        type: typeof organizationId,
        userId: userData.id
      });
      return badRequest('Invalid organization assignment');
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

    // Always use admin client for inserts to bypass RLS and ensure organization_id is set
    // RLS policies might interfere with organization_id being set correctly
    // Reuse the same admin client we used for user lookup
    
    // Build insert data with explicit organization_id
    const insertData: any = {
      owner_id: userData.id,
      organization_id: organizationId.trim(), // Ensure it's trimmed
      name: name.trim(),
      description: description ? description.trim() : null,
      status: status || 'idea',
      primary_tool: primary_tool || null,
      company_id: company_id || null,
      source: 'Manual', // Default for manually created projects
    };

    // Final validation before insert
    if (!insertData.organization_id) {
      logger.error('[Projects API POST] organization_id is null/empty in insertData:', {
        insertData,
        originalOrganizationId: organizationId,
        userData
      });
      return internalError('Failed to set organization_id for project');
    }

    logger.info('[Projects API POST] Creating project:', {
      organization_id: insertData.organization_id,
      owner_id: insertData.owner_id,
      name: insertData.name,
      hasOrganizationId: !!insertData.organization_id,
      insertDataKeys: Object.keys(insertData),
      insertDataString: JSON.stringify(insertData),
    });
    
    // Verify organization_id one more time right before insert
    const finalOrganizationId = String(insertData.organization_id).trim();
    if (!finalOrganizationId || finalOrganizationId === 'null' || finalOrganizationId === 'undefined' || finalOrganizationId === '') {
      logger.error('[Projects API POST] CRITICAL: organization_id is invalid right before insert:', {
        organization_id: insertData.organization_id,
        finalOrganizationId,
        type: typeof insertData.organization_id,
        userData,
        insertData
      });
      return internalError('Failed to set organization_id for project. Please contact support.');
    }

    // Build the final insert object with explicit organization_id - rebuild to ensure all fields are correct
    const finalInsertData = {
      owner_id: userData.id,
      organization_id: finalOrganizationId, // Use the validated and trimmed value
      name: name.trim(),
      description: description ? description.trim() : null,
      status: status || 'idea',
      primary_tool: primary_tool || null,
      company_id: company_id || null,
      source: 'Manual',
    };

    logger.info('[Projects API POST] Final insert data before database call:', {
      ...finalInsertData,
      organization_id_type: typeof finalInsertData.organization_id,
      organization_id_length: finalInsertData.organization_id?.length,
      organization_id_value: finalInsertData.organization_id,
    });

    // Try using the database function first (runs with SECURITY DEFINER, bypasses RLS completely)
    // If that fails, fall back to direct insert with admin client
    let project;
    let projectError;
    
    // Log the exact values being passed to RPC
    logger.info('[Projects API POST] Calling RPC function with:', {
      p_owner_id: finalInsertData.owner_id,
      p_organization_id: finalInsertData.organization_id,
      p_name: finalInsertData.name,
      p_description: finalInsertData.description,
      p_status: finalInsertData.status,
      p_primary_tool: finalInsertData.primary_tool,
      p_company_id: finalInsertData.company_id,
      p_source: finalInsertData.source,
    });
    
    try {
      const { data: functionResult, error: functionError } = await adminClientForUser
        .rpc('create_project_with_org', {
          p_owner_id: finalInsertData.owner_id,
          p_organization_id: finalInsertData.organization_id,
          p_name: finalInsertData.name,
          p_description: finalInsertData.description || null,
          p_status: finalInsertData.status,
          p_primary_tool: finalInsertData.primary_tool || null,
          p_company_id: finalInsertData.company_id || null,
          p_source: finalInsertData.source,
        });

      if (functionError) {
        logger.error('[Projects API POST] RPC function failed:', {
          error: functionError,
          message: functionError.message,
          code: functionError.code,
          details: functionError.details,
          hint: functionError.hint,
        });
        
        // Fall back to direct insert with admin client (should bypass RLS)
        logger.info('[Projects API POST] Falling back to direct insert with admin client');
        const { data: directResult, error: directError } = await adminClientForUser
          .from('projects')
          .insert({
            owner_id: finalInsertData.owner_id,
            organization_id: finalInsertData.organization_id, // Explicitly set
            name: finalInsertData.name,
            description: finalInsertData.description,
            status: finalInsertData.status,
            primary_tool: finalInsertData.primary_tool,
            company_id: finalInsertData.company_id,
            source: finalInsertData.source,
          })
          .select()
          .single();
        
        project = directResult;
        projectError = directError;
      } else if (functionResult) {
        project = functionResult;
        projectError = null;
        logger.info('[Projects API POST] RPC function succeeded');
      } else {
        logger.error('[Projects API POST] RPC function returned no result');
        projectError = { message: 'RPC function returned no result' };
      }
    } catch (rpcError: any) {
      logger.error('[Projects API POST] RPC call exception:', rpcError);
      // Fall back to direct insert if RPC function doesn't exist or fails
      const { data: directResult, error: directError } = await adminClientForUser
        .from('projects')
        .insert({
          owner_id: finalInsertData.owner_id,
          organization_id: finalInsertData.organization_id, // Explicitly set
          name: finalInsertData.name,
          description: finalInsertData.description,
          status: finalInsertData.status,
          primary_tool: finalInsertData.primary_tool,
          company_id: finalInsertData.company_id,
          source: finalInsertData.source,
        })
        .select()
        .single();
      
      project = directResult;
      projectError = directError;
    }

    if (projectError) {
      logger.error('[Projects API POST] Error creating project:', {
        error: projectError,
        errorMessage: projectError.message,
        errorCode: projectError.code,
        errorDetails: projectError.details,
        errorHint: projectError.hint,
        finalInsertData: JSON.stringify(finalInsertData),
        organizationId: finalInsertData.organization_id,
        userData
      });
      
      // If it's specifically the organization_id constraint error, provide more context
      if (projectError.message?.includes('organization_id') && projectError.message?.includes('not-null')) {
        return internalError(`Failed to create project: organization_id constraint violation. Organization ID was: ${finalInsertData.organization_id || 'NULL'}. Please contact support.`, {
          error: projectError.message,
          organizationId: finalInsertData.organization_id,
        });
      }
      
      return internalError('Failed to create project', { error: projectError.message });
    }

    // Create notification for project owner if different from creator
    if (project.owner_id && project.owner_id !== userData.id) {
      const { data: creator } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.id)
        .single();

      const creatorName = creator?.name || null;
      const projectLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/project/${project.id}`;

      // Send in-app notification
      notifyProjectCreated(
        project.owner_id,
        userData.id,
        project.id,
        project.name,
        creatorName
      ).catch((err) => {
        logger.error('[Project] Error creating notification:', err);
      });

      // Send email notification (non-blocking)
      sendProjectCreatedEmail(
        project.owner_id,
        project.name,
        creatorName || 'Someone',
        projectLink
      ).catch((err) => {
        logger.error('[Project] Error sending email notification:', err);
      });
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/projects:', error);
    return internalError('Failed to create project', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

