import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { notifyProjectCreated } from '@/lib/notifications';
import { sendProjectCreatedEmail } from '@/lib/emailNotifications';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, validateOrganizationAccess } from '@/lib/organizationContext';
import { canCreateProject } from '@/lib/packageLimits';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';
import { isObject, hasStringProperty, isNonNullable } from '@/lib/utils/typeGuards';

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

    // CRITICAL: Validate organization_id format (should be UUID)
    if (!isValidUUID(organizationId)) {
      logger.error('[Projects API] Invalid organization_id format:', {
        userId: userData.id,
        authId: authUser.id,
        organizationId,
        organizationIdType: typeof organizationId,
      });
      return badRequest('Invalid organization assignment. Please contact support.');
    }

    // Log for debugging (debug level to reduce console noise)
    logger.debug('[Projects API] User organization context:', {
      userId: userData.id,
      authId: authUser.id,
      organizationId,
      role: userData.role,
      isSuperAdmin: userData.is_super_admin,
    });

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query with company join
    // CRITICAL: Always use admin client to ensure organization_id filter is enforced
    // Regular client might have RLS policies that leak data
    const adminClient = createAdminSupabaseClient();
    let query = adminClient
      .from('projects')
      .select(`
        *,
        company:companies(id, name)
      `, { count: 'exact' });

    // Track accessible project IDs for post-query filtering
    let allAccessibleProjectIds: string[] = [];

    // IMPORTANT: Even super admins should only see their own organization's projects
    // in the regular project-management area. Use /global/admin for cross-organization access.
    // ALL users (including super admins) MUST filter by organization_id in this endpoint
    // Regular users: MUST filter by organization_id to prevent cross-organization access
    // OPTIMIZATION: Fetch owned projects and member projects in PARALLEL
    {
      
      // Build owned projects query
      let ownedProjectsQuery = adminClient
        .from('projects')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('owner_id', userData.id);
      
      if (companyId) {
        ownedProjectsQuery = ownedProjectsQuery.eq('company_id', companyId);
      }
      
      // OPTIMIZATION: Run owned and member queries in parallel
      const [ownedResult, memberResult] = await Promise.all([
        ownedProjectsQuery,
        adminClient
          .from('project_members')
          .select(`
            project_id,
            project:projects!project_members_project_id_fkey(id, organization_id)
          `)
          .eq('user_id', userData.id),
      ]);

      const { data: ownedProjects, error: ownedError } = ownedResult;
      const { data: memberProjects, error: memberError } = memberResult;
      
      if (ownedError) {
        logger.error('Error loading owned projects:', ownedError);
        return internalError('Failed to load owned projects', { error: ownedError.message });
      }
      
      if (memberError) {
        logger.error('Error loading project members:', memberError);
        return internalError('Failed to load project members', { error: memberError.message });
      }
      
      const ownedProjectIds = (ownedProjects || [])
        .filter((p): p is { id: string } => isObject(p) && hasStringProperty(p, 'id'))
        .map(p => p.id);

      // Filter member projects to ONLY include those in the user's organization
      // Supabase can return nested relations as either single object or array
      const memberProjectIds: string[] = [];
      for (const mp of memberProjects || []) {
        if (!isObject(mp) || !hasStringProperty(mp, 'project_id')) continue;
        
        // Handle Supabase nested relation - can be object or array
        const projectData = mp.project;
        let project: { organization_id: string } | null = null;
        
        if (Array.isArray(projectData) && projectData.length > 0) {
          const first = projectData[0];
          if (isObject(first) && hasStringProperty(first, 'organization_id')) {
            project = first as { organization_id: string };
          }
        } else if (isObject(projectData) && hasStringProperty(projectData, 'organization_id')) {
          project = projectData as { organization_id: string };
        }
        
        if (!project) continue;
        
        // CRITICAL: Verify project belongs to user's organization  
        const projectOrgId = project.organization_id;
        if (!projectOrgId || projectOrgId !== organizationId) {
          if (projectOrgId) {
            logger.warn('[Projects API] Member project from different organization detected and filtered:', {
              projectId: mp.project_id,
              projectOrgId,
              userOrgId: organizationId,
              userId: userData.id,
            });
          }
          continue;
        }
        memberProjectIds.push(mp.project_id);
      }
      
      // 3. Combine owned and member project IDs (remove duplicates)
      allAccessibleProjectIds = [...new Set([...ownedProjectIds, ...memberProjectIds])];
      
      // CRITICAL SECURITY STEP: Verify each project ID actually belongs to user's organization
      // This prevents any cross-organization access even if there's a data inconsistency
      // Use admin client to ensure filter is enforced
      if (allAccessibleProjectIds.length > 0) {
        const { data: verifiedProjects, error: verifyError } = await adminClient
          .from('projects')
          .select('id, organization_id')
          .in('id', allAccessibleProjectIds)
          .eq('organization_id', organizationId); // Only get projects from user's organization
        
        if (verifyError) {
          logger.error('[Projects API] Error verifying project organization:', verifyError);
          return internalError('Failed to verify project access', { error: verifyError.message });
        }
        
        // Type for verified project
        type VerifiedProject = { id: string; organization_id: string };
        
        // Use only verified project IDs
        const typedVerifiedProjects = (verifiedProjects || [])
          .filter((p): p is VerifiedProject => 
            isObject(p) && hasStringProperty(p, 'id') && hasStringProperty(p, 'organization_id')
          );
        
        const verifiedProjectIds = typedVerifiedProjects
          .map(p => p.id)
          .filter((id: string) => {
            const project = typedVerifiedProjects.find(p => p.id === id);
            if (project && project.organization_id !== organizationId) {
              logger.error('[Projects API] CRITICAL: Project ID verification failed:', {
                projectId: id,
                projectOrgId: project.organization_id,
                userOrgId: organizationId,
              });
              return false;
            }
            return true;
          });
        
        allAccessibleProjectIds = verifiedProjectIds;
        
        // Log any projects that were filtered out
        const filteredOut = allAccessibleProjectIds.length < [...new Set([...ownedProjectIds, ...memberProjectIds])].length;
        if (filteredOut) {
          logger.warn('[Projects API] Filtered out projects that did not belong to organization:', {
            originalCount: [...new Set([...ownedProjectIds, ...memberProjectIds])].length,
            verifiedCount: allAccessibleProjectIds.length,
            userId: userData.id,
            organizationId,
          });
        }
      }
      
      if (allAccessibleProjectIds.length === 0) {
        // User has no accessible projects
        const response = NextResponse.json({
          data: [],
          total: 0,
          limit,
          offset,
        });
        response.headers.set('Cache-Control', 'private, max-age=10'); // 10 second cache for empty results
        return response;
      }
      
      // 4. Build final query - CRITICAL: ALWAYS filter by organization_id at database level
      // This is the PRIMARY security control - organization_id filter MUST be enforced
      logger.debug('[Projects API] Building query with organization filter:', {
        userId: userData.id,
        organizationId,
        ownedCount: ownedProjectIds.length,
        memberCount: memberProjectIds.length,
        verifiedCount: allAccessibleProjectIds.length,
      });
      
      // CRITICAL SECURITY: Filter by organization_id FIRST - this is the primary security control
      // If this filter fails, we have a critical security breach
      query = query.eq('organization_id', organizationId);
      
      // Additional filter: If we have accessible project IDs, also filter by those
      // This provides defense-in-depth but organization_id is the primary filter
      if (allAccessibleProjectIds.length > 0) {
        query = query.in('id', allAccessibleProjectIds);
      }
      
      // Filter by company_id if provided (within organization)
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
    }

    query = query.order('updated_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Log query details before execution (debug level to reduce console noise)
    logger.debug('[Projects API] Executing query with filters:', {
      userId: userData.id,
      organizationId,
      isSuperAdmin: userData.role === 'admin' && userData.is_super_admin === true,
      accessibleProjectIdsCount: allAccessibleProjectIds.length,
      limit,
      offset,
    });

    // Execute query with organization_id filter enforced
    const { data: projects, error: projectsError, count } = await query;
    
    // Log query execution results for debugging (debug level to reduce console noise)
    logger.debug('[Projects API] Query executed:', {
      projectsReturned: projects?.length || 0,
      countFromDB: count || 0,
      organizationId,
      userId: userData.id,
    });

    if (projectsError) {
      logger.error('Error loading projects:', projectsError);
      return internalError('Failed to load projects', { error: projectsError.message });
    }

    // Type for project from query
    type ProjectQueryResult = {
      id: string;
      name: string;
      organization_id: string;
      [key: string]: unknown;
    };
    
    // Log raw results before filtering (debug level to reduce console noise)
    const typedProjects = (projects || []).filter((p): p is ProjectQueryResult => 
      isObject(p) && hasStringProperty(p, 'id') && hasStringProperty(p, 'name') && hasStringProperty(p, 'organization_id')
    );
    
    logger.debug('[Projects API] Raw query results:', {
      projectsReturned: typedProjects.length,
      organizationId,
      projectOrganizationIds: typedProjects.map(p => ({
        id: p.id,
        name: p.name,
        organization_id: p.organization_id,
      })),
    });

    // CRITICAL SECURITY CHECK: Filter results by accessible project IDs AND verify organization_id
    // This is defense-in-depth to ensure no cross-organization access
    // ALL users (including super admins) are filtered by organization_id in this endpoint
    const allProjects = typedProjects;
    const accessibleProjectIdsSet = new Set(allAccessibleProjectIds);
    
    const filteredProjects = allProjects.filter((project) => {
      // CRITICAL: For ALL users (including super admins), verify organization_id matches EXACTLY
      // Super admins should use /global/admin routes for cross-organization access
      const projectOrgId = project.organization_id;
      if (!projectOrgId || projectOrgId !== organizationId) {
        logger.error('[Projects API] SECURITY ISSUE: Project from wrong organization returned!', {
          projectId: project.id,
          projectName: project.name,
          projectOrgId,
          userOrgId: organizationId,
          userId: userData.id,
          userRole: userData.role,
          isSuperAdmin: userData.is_super_admin,
          queryOrganizationId: organizationId,
        });
        return false;
      }
      
      // CRITICAL: Verify project is in accessible list (owned or member)
      // Only check if we have accessible IDs (non-empty array)
      if (allAccessibleProjectIds.length > 0 && !accessibleProjectIdsSet.has(project.id)) {
        logger.error('[Projects API] SECURITY ISSUE: Project not in accessible list!', {
          projectId: project.id,
          projectName: project.name,
          projectOrgId: project.organization_id,
          userOrgId: organizationId,
          userId: userData.id,
          accessibleIdsCount: allAccessibleProjectIds.length,
          accessibleIds: Array.from(accessibleProjectIdsSet).slice(0, 10),
        });
        return false;
      }
      
      return true;
    });

    // Log if any projects were filtered out (security incident)
    if (filteredProjects.length !== allProjects.length) {
      logger.error('[Projects API] CRITICAL SECURITY ISSUE: Filtered out projects!', {
        returnedCount: allProjects.length,
        filteredCount: filteredProjects.length,
        filteredOut: allProjects.length - filteredProjects.length,
        userOrgId: organizationId,
        userId: userData.id,
        filteredProjectIds: allProjects
          .filter(p => !filteredProjects.find(fp => fp.id === p.id))
          .map(p => ({ id: p.id, name: p.name, orgId: p.organization_id })),
      });
    }

    // CRITICAL: Final security check - verify NO projects from other organizations
    // ALL users (including super admins) must be filtered by organization_id
    const finalSecurityCheck = filteredProjects.filter((project) => {
      return project.organization_id === organizationId;
    });
    
    if (finalSecurityCheck.length !== filteredProjects.length) {
      logger.error('[Projects API] CRITICAL SECURITY BREACH: Final check filtered out projects!', {
        beforeFinalCheck: filteredProjects.length,
        afterFinalCheck: finalSecurityCheck.length,
        userOrgId: organizationId,
        userId: userData.id,
        isSuperAdmin: userData.is_super_admin,
      });
    }

    // Calculate total count based on accessible projects in user's organization
    // Since we're filtering by organization_id and accessible IDs, use the filtered count
    const totalCount = finalSecurityCheck.length;

    const response = NextResponse.json({
      data: finalSecurityCheck,
      total: totalCount,
      limit,
      offset,
    });
    response.headers.set('Cache-Control', 'private, max-age=10'); // 10 second cache for projects list
    return response;
  } catch (error) {
    logger.error('Error in GET /api/projects:', error);
    return internalError('Failed to load projects', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify CSRF token for state-changing requests
    const { requireCsrfToken, shouldSkipCsrf } = await import('@/lib/utils/csrf');
    if (!shouldSkipCsrf(request.nextUrl.pathname)) {
      const csrfError = await requireCsrfToken(request);
      if (csrfError) {
        return csrfError;
      }
    }

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
    // Use admin client to bypass RLS and avoid recursion
    if (company_id) {
      const { data: company, error: companyError } = await adminClientForUser
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
    const insertData = {
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
    let project: Record<string, unknown> | null = null;
    let projectError: { message: string; code?: string; details?: string; hint?: string } | null = null;
    
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
    } catch (rpcError) {
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
    const projectOwnerId = project?.owner_id;
    const projectId = project?.id as string | undefined;
    const projectName = project?.name as string | undefined;
    
    if (project && projectOwnerId && projectOwnerId !== userData.id && projectId && projectName) {
      const { data: creator } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.id)
        .single();

      const creatorName = creator?.name || null;
      const projectLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/project/${projectId}`;

      // Send in-app notification
      notifyProjectCreated(
        projectOwnerId as string,
        userData.id,
        projectId,
        projectName,
        creatorName
      ).catch((err) => {
        logger.error('[Project] Error creating notification:', err);
      });

      // Send email notification (non-blocking)
      sendProjectCreatedEmail(
        projectOwnerId as string,
        projectName,
        creatorName || 'Someone',
        projectLink
      ).catch((err) => {
        logger.error('[Project] Error sending email notification:', err);
      });
    }

    // Invalidate caches to ensure fresh data in sidebar and other components
    // Run in background (non-blocking) to not delay the response
    if (projectId) {
      import('@/lib/cache/cacheInvalidation').then(({ invalidateProjectCache }) => {
        invalidateProjectCache(projectId, organizationId).catch((cacheError) => {
          logger.warn('[Projects API POST] Failed to invalidate cache:', cacheError);
        });
      }).catch((importError) => {
        logger.warn('[Projects API POST] Failed to import cache module:', importError);
      });
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/projects:', error);
    return internalError('Failed to create project', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

