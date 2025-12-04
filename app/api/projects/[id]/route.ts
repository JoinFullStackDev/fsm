import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, forbidden, badRequest } from '@/lib/utils/apiErrors';
import { isValidUUID } from '@/lib/utils/inputSanitization';
import logger from '@/lib/utils/logger';

/**
 * GET /api/projects/[id]
 * 
 * Fetches a single project by ID along with its active phases.
 * Requires authentication.
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing project ID
 * @returns Project data with phases array, or error response
 * 
 * @example
 * GET /api/projects/123e4567-e89b-12d3-a456-426614174000
 * Response: { id, name, description, status, phases: [...] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return badRequest('Invalid project ID format');
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to view this project');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record using admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Projects API] User not found:', userError);
      return notFound('User not found');
    }

    // Use admin client to avoid RLS recursion when querying projects and companies
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select(`
        *,
        company:companies(id, name),
        owner:users!projects_owner_id_fkey(id, name, email, avatar_url)
      `)
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      logger.error('[Projects API] Error fetching project:', { 
        projectId: params.id, 
        error: projectError 
      });
      return notFound('Project not found');
    }

    // Validate access: super admins can see all projects
    // For others, check if they're a project member OR project owner OR project belongs to their organization
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const projectInUserOrg = project.organization_id === organizationId;
    
    if (!isSuperAdmin && !isProjectOwner && !projectInUserOrg) {
      // Check if user is a project member
      const { data: projectMember } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .single();
      
      if (!projectMember) {
        return forbidden('You do not have access to this project');
      }
    }

    // Get phases (ordered by display_order) - Use cached query with fallback
    const { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache/unifiedCache');
    const phasesCacheKey = CACHE_KEYS.projectPhases(params.id);
    
    const phases = await cacheGetOrSet(
      phasesCacheKey,
      async () => {
        const { data: phasesData, error: phasesError } = await adminClient
          .from('project_phases')
          .select('phase_number, phase_name, display_order, completed, updated_at')
          .eq('project_id', params.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (phasesError) {
          logger.error('Error loading phases:', phasesError);
          throw new Error(`Failed to load project phases: ${phasesError.message}`);
        }

        return phasesData || [];
      },
      CACHE_TTL.PROJECT_PHASES
    );

    const response = NextResponse.json({
      ...project,
      phases: phases || [],
    });
    
    // Add cache headers
    response.headers.set('Cache-Control', 'private, max-age=120'); // 2 minutes
    return response;
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]:', error);
    return internalError('Failed to load project', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return badRequest('Invalid project ID format');
    }

    // Verify CSRF token for state-changing requests
    const { requireCsrfToken, shouldSkipCsrf } = await import('@/lib/utils/csrf');
    if (!shouldSkipCsrf(request.nextUrl.pathname)) {
      const csrfError = await requireCsrfToken(request);
      if (csrfError) {
        return csrfError;
      }
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to update this project');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record using admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Projects API PUT] User not found:', userError);
      return notFound('User not found');
    }

    const body = await request.json();
    const { name, description, status, primary_tool, template_id, company_id } = body;

    // Get current project to check if template_id is changing and validate access
    // Use admin client to avoid RLS recursion
    const { data: currentProject, error: currentProjectError } = await adminClient
      .from('projects')
      .select('template_id, organization_id')
      .eq('id', params.id)
      .single();

    if (currentProjectError || !currentProject) {
      return notFound('Project not found');
    }

    // Validate organization access (super admins can update all projects)
    if (userData.role !== 'admin' || userData.is_super_admin !== true) {
      if (currentProject.organization_id !== organizationId) {
        return forbidden('You do not have access to update this project');
      }
    }

    const oldTemplateId = currentProject.template_id;
    const newTemplateId = template_id !== undefined ? (template_id || null) : oldTemplateId;
    const templateChanged = oldTemplateId !== newTemplateId;

    const updateData: any = {
      name,
      description,
      status,
      primary_tool,
      updated_at: new Date().toISOString(),
    };

    // Only update template_id if it's provided
    if (template_id !== undefined) {
      updateData.template_id = template_id || null;
    }

    // Only update company_id if it's provided
    if (company_id !== undefined) {
      // Verify company exists if company_id is provided
      // Use admin client to avoid RLS recursion
      if (company_id) {
        const { data: company, error: companyError } = await adminClient
          .from('companies')
          .select('id')
          .eq('id', company_id)
          .single();

        if (companyError || !company) {
          if (companyError?.code === 'PGRST116') {
            return badRequest('Company not found');
          }
          logger.error('Error checking company:', companyError);
          return internalError('Failed to check company', { error: companyError?.message });
        }
      }
      updateData.company_id = company_id || null;
    }

    // Use admin client to avoid RLS recursion
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (projectError) {
      logger.error('Error updating project:', projectError);
      return internalError('Failed to update project', { error: projectError.message });
    }

    if (!project) {
      return notFound('Project not found');
    }

    // If template changed, regenerate project phases from the new template (fresh start)
    if (templateChanged && newTemplateId) {
      try {
        logger.debug(`Template changed for project ${params.id}: ${oldTemplateId} -> ${newTemplateId}`);
        
        // Get template phases using admin client to avoid RLS recursion
        const { data: templatePhases, error: templatePhasesError } = await adminClient
          .from('template_phases')
          .select('*')
          .eq('template_id', newTemplateId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (templatePhasesError) {
          logger.error('Error loading template phases:', templatePhasesError);
          return internalError('Failed to load template phases', { error: templatePhasesError.message });
        }

        if (!templatePhases || templatePhases.length === 0) {
          logger.warn(`Template ${newTemplateId} has no phases`);
          return internalError('Selected template has no phases defined');
        }

        logger.debug(`Found ${templatePhases.length} template phases to create`);

        // Deactivate all existing phases (soft delete - avoids RLS DELETE policy issues)
        // Then we'll insert new ones, which will replace them due to unique constraint
        // Use admin client to avoid RLS recursion
        const { data: existingPhases, error: checkExistingError } = await adminClient
          .from('project_phases')
          .select('phase_number')
          .eq('project_id', params.id)
          .eq('is_active', true);

        if (checkExistingError) {
          logger.warn('Error checking existing phases (non-critical):', checkExistingError);
        } else if (existingPhases && existingPhases.length > 0) {
          logger.debug(`Found ${existingPhases.length} existing active phases to deactivate`);
          
          // Deactivate all existing phases (soft delete - UPDATE is allowed by RLS)
          // Use admin client to avoid RLS recursion
          const { error: deactivateError } = await adminClient
            .from('project_phases')
            .update({ is_active: false })
            .eq('project_id', params.id)
            .eq('is_active', true);

          if (deactivateError) {
            logger.error('Error deactivating old phases:', deactivateError);
            return internalError('Failed to deactivate old phases', { error: deactivateError.message });
          }

          logger.debug(`Deactivated ${existingPhases.length} existing phases`);
        }

      // Create new phases from template (fresh start - use template data, not existing data)
      // Ensure all required fields are present and valid
      const phaseInserts = templatePhases.map((templatePhase, index) => {
        // Ensure phase_number is present and valid
        if (!templatePhase.phase_number || typeof templatePhase.phase_number !== 'number') {
          logger.error(`Template phase at index ${index} is missing or invalid phase_number:`, templatePhase);
          throw new Error(`Template phase at index ${index} is missing or invalid phase_number`);
        }
        
        // Ensure phase_number is positive
        if (templatePhase.phase_number <= 0) {
          logger.error(`Template phase at index ${index} has invalid phase_number (must be > 0):`, templatePhase.phase_number);
          throw new Error(`Template phase at index ${index} has invalid phase_number (must be > 0)`);
        }
        
        // Use display_order from template, or fallback to index + 1
        const displayOrder = templatePhase.display_order != null ? templatePhase.display_order : (index + 1);
        
        // Ensure display_order is a number
        if (typeof displayOrder !== 'number' || displayOrder <= 0) {
          logger.error(`Template phase at index ${index} has invalid display_order:`, displayOrder);
          throw new Error(`Template phase at index ${index} has invalid display_order`);
        }
        
        // Use phase_name from template, or generate a default name
        const phaseName = templatePhase.phase_name || `Phase ${templatePhase.phase_number}`;
        
        // Ensure phase_name is a string
        if (typeof phaseName !== 'string' || phaseName.trim().length === 0) {
          logger.error(`Template phase at index ${index} has invalid phase_name:`, phaseName);
          throw new Error(`Template phase at index ${index} has invalid phase_name`);
        }
        
        // Ensure data is a valid object (JSONB)
        let phaseData = {};
        if (templatePhase.data) {
          if (typeof templatePhase.data === 'object' && !Array.isArray(templatePhase.data)) {
            phaseData = templatePhase.data;
          } else {
            logger.warn(`Template phase at index ${index} has invalid data format, using empty object`);
            phaseData = {};
          }
        }
        
        return {
          project_id: params.id,
          phase_number: templatePhase.phase_number,
          phase_name: phaseName.trim(),
          display_order: displayOrder,
          data: phaseData,
          completed: false,
          is_active: true,
        };
      });

      // Validate phase inserts before attempting insert
      if (phaseInserts.length === 0) {
        return internalError('No phases to create from template');
      }

      // Check for duplicate phase_numbers in the template (shouldn't happen, but safety check)
      const phaseNumbers = phaseInserts.map(p => p.phase_number);
      const uniquePhaseNumbers = new Set(phaseNumbers);
      if (phaseNumbers.length !== uniquePhaseNumbers.size) {
        logger.error('Duplicate phase numbers detected in template phases:', phaseNumbers);
        const duplicates = phaseNumbers.filter((num, idx) => phaseNumbers.indexOf(num) !== idx);
        return internalError(`Template has duplicate phase numbers: ${duplicates.join(', ')}`);
      }

      // Log what we're about to insert for debugging
      logger.debug('About to insert phases:', JSON.stringify(phaseInserts.map(p => ({
        phase_number: p.phase_number,
        phase_name: p.phase_name,
        display_order: p.display_order
      })), null, 2));

      // Final check - ensure no active phases exist with these phase_numbers
      // Upsert will handle inactive phases with same phase_numbers
      // Use admin client to avoid RLS recursion
      const phaseNumbersToInsert = phaseInserts.map(p => p.phase_number);
      const { data: conflictingPhases, error: conflictCheckError } = await adminClient
        .from('project_phases')
        .select('phase_number, is_active')
        .eq('project_id', params.id)
        .in('phase_number', phaseNumbersToInsert)
        .eq('is_active', true);

      if (conflictCheckError) {
        logger.warn('Error checking for conflicting phases (non-critical):', conflictCheckError);
      } else if (conflictingPhases && conflictingPhases.length > 0) {
        logger.warn('Found active conflicting phases - deactivating them:', conflictingPhases);
        // Deactivate the specific conflicting phases (UPDATE is allowed by RLS)
        // Use admin client to avoid RLS recursion
        const { error: deactivateConflictsError } = await adminClient
          .from('project_phases')
          .update({ is_active: false })
          .eq('project_id', params.id)
          .in('phase_number', phaseNumbersToInsert)
          .eq('is_active', true);
        
        if (deactivateConflictsError) {
          return internalError('Failed to deactivate conflicting phases', { 
            error: deactivateConflictsError.message 
          });
        }
      }

      // Use upsert to handle any remaining inactive phases with same phase_numbers
      // This will update existing inactive phases or insert new ones
      // The unique constraint on (project_id, phase_number) means upsert will update existing rows
      // Use admin client to avoid RLS recursion
      const { data: insertedPhases, error: insertPhasesError } = await adminClient
        .from('project_phases')
        .upsert(phaseInserts, {
          onConflict: 'project_id,phase_number',
        })
        .select();

      if (insertPhasesError) {
        logger.error('Error inserting new phases:', insertPhasesError);
        logger.error('Phase inserts data:', JSON.stringify(phaseInserts, null, 2));
        logger.error('Template phases data:', JSON.stringify(templatePhases, null, 2));
        
        // Return a more user-friendly error message
        let errorMessage = 'Failed to create phases from template';
        if (insertPhasesError.message) {
          errorMessage += `: ${insertPhasesError.message}`;
        }
        if (insertPhasesError.hint) {
          errorMessage += ` (${insertPhasesError.hint})`;
        }
        
        return internalError(errorMessage, { 
          error: insertPhasesError.message,
          details: insertPhasesError.details,
          hint: insertPhasesError.hint,
          code: insertPhasesError.code,
        });
      }

      if (!insertedPhases || insertedPhases.length === 0) {
        logger.error('No phases were inserted despite no error');
        return internalError('Failed to create phases from template - no phases were created');
      }

        logger.debug(`Successfully created ${insertedPhases.length} phases for project ${params.id} from template ${newTemplateId}`);
        logger.debug('Created phases:', JSON.stringify(insertedPhases.map(p => ({ 
          phase_number: p.phase_number, 
          phase_name: p.phase_name, 
          display_order: p.display_order 
        })), null, 2));
      } catch (error) {
        logger.error('Unexpected error during phase creation:', error);
        return internalError('Failed to create phases from template', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    } else if (templateChanged && !newTemplateId) {
      // Template was removed (set to null) - keep existing phases but log
      logger.debug(`Template removed for project ${params.id}, keeping existing phases`);
    }

    return NextResponse.json(project);
  } catch (error) {
    logger.error('Error in PUT /api/projects/[id]:', error);
    return internalError('Failed to update project', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return badRequest('Invalid project ID format');
    }

    // Verify CSRF token for state-changing requests
    const { requireCsrfToken, shouldSkipCsrf } = await import('@/lib/utils/csrf');
    if (!shouldSkipCsrf(request.nextUrl.pathname)) {
      const csrfError = await requireCsrfToken(request);
      if (csrfError) {
        return csrfError;
      }
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to delete projects');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get user record using admin client to avoid RLS recursion
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Projects API DELETE] User not found:', userError);
      return notFound('User not found');
    }

    // Only admins can delete projects
    if (userData.role !== 'admin') {
      return forbidden('Admin role required to delete projects');
    }

    // Get project to validate organization access (super admins can delete all projects)
    // Use admin client to avoid RLS recursion
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('organization_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Validate organization access (super admins can delete all projects)
    if (userData.is_super_admin !== true) {
      if (project.organization_id !== organizationId) {
        return forbidden('You do not have access to delete this project');
      }
    }

    // Delete the project using admin client to bypass RLS
    // This is necessary because cascade operations (like updating invoices when project_id is set to NULL)
    // may trigger other operations that need to bypass RLS
    const { error: deleteError } = await adminClient
      .from('projects')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      logger.error('Error deleting project:', deleteError);
      return internalError('Failed to delete project', { error: deleteError.message });
    }

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Error in DELETE /api/projects/[id]:', error);
    return internalError('Failed to delete project', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

