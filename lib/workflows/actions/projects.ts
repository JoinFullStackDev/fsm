/**
 * Project Actions
 * Create projects and create from templates via workflow automation
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { interpolateTemplate, getNestedValue } from '../templating';
import type { CreateProjectConfig, WorkflowContext } from '@/types/workflows';
import logger from '@/lib/utils/logger';

/**
 * Execute create project action
 * 
 * @param config - Project creation configuration
 * @param context - Workflow context
 * @returns Action result with created project details
 */
export async function executeCreateProject(
  config: CreateProjectConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const projectConfig = config as CreateProjectConfig;
  const supabase = createAdminSupabaseClient();
  
  // Interpolate text fields
  const name = interpolateTemplate(projectConfig.name, context);
  const description = projectConfig.description
    ? interpolateTemplate(projectConfig.description, context)
    : null;
  
  // Get company ID if specified
  let companyId: string | null = null;
  if (projectConfig.company_id) {
    companyId = interpolateTemplate(projectConfig.company_id, context);
  } else if (projectConfig.company_field) {
    const fieldValue = getNestedValue(context, projectConfig.company_field);
    companyId = typeof fieldValue === 'string' ? fieldValue : null;
  }
  
  logger.info('[CreateProject] Creating project:', {
    name,
    companyId,
    organizationId: context.organization_id,
  });
  
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        company_id: companyId,
        organization_id: context.organization_id,
        status: 'idea',
        source: 'Manual',
      })
      .select()
      .single();
    
    if (error) {
      logger.error('[CreateProject] Failed to create project:', {
        error: error.message,
        name,
      });
      throw new Error(`Failed to create project: ${error.message}`);
    }
    
    logger.info('[CreateProject] Project created:', {
      projectId: project.id,
      name: project.name,
    });
    
    return {
      output: {
        success: true,
        project_id: project.id,
        project,
        created_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[CreateProject] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      name,
    });
    throw error;
  }
}

/**
 * Execute create project from template action
 * 
 * @param config - Project creation configuration with template
 * @param context - Workflow context
 * @returns Action result with created project details
 */
export async function executeCreateProjectFromTemplate(
  config: CreateProjectConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const projectConfig = config as CreateProjectConfig;
  const supabase = createAdminSupabaseClient();
  
  // Template ID is required for this action
  if (!projectConfig.template_id) {
    throw new Error('template_id is required for create_project_from_template action');
  }
  
  const templateId = interpolateTemplate(projectConfig.template_id, context);
  
  // Verify template exists and get its data
  const { data: template, error: templateError } = await supabase
    .from('project_templates')
    .select('*')
    .eq('id', templateId)
    .single();
  
  if (templateError || !template) {
    logger.error('[CreateProjectFromTemplate] Template not found:', {
      templateId,
      error: templateError?.message,
    });
    throw new Error(`Template not found: ${templateId}`);
  }
  
  // Interpolate text fields
  const name = interpolateTemplate(projectConfig.name, context);
  const description = projectConfig.description
    ? interpolateTemplate(projectConfig.description, context)
    : template.description;
  
  // Get company ID if specified
  let companyId: string | null = null;
  if (projectConfig.company_id) {
    companyId = interpolateTemplate(projectConfig.company_id, context);
  } else if (projectConfig.company_field) {
    const fieldValue = getNestedValue(context, projectConfig.company_field);
    companyId = typeof fieldValue === 'string' ? fieldValue : null;
  }
  
  logger.info('[CreateProjectFromTemplate] Creating project from template:', {
    name,
    templateId,
    templateName: template.name,
    organizationId: context.organization_id,
  });
  
  try {
    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        company_id: companyId,
        organization_id: context.organization_id,
        template_id: templateId,
        status: 'idea',
        source: 'Manual',
      })
      .select()
      .single();
    
    if (projectError || !project) {
      logger.error('[CreateProjectFromTemplate] Failed to create project:', {
        error: projectError?.message,
        name,
      });
      throw new Error(`Failed to create project: ${projectError?.message}`);
    }
    
    // Get template phases
    const { data: templatePhases } = await supabase
      .from('template_phases')
      .select('*')
      .eq('template_id', templateId)
      .order('phase_number', { ascending: true });
    
    // Create project phases from template
    if (templatePhases && templatePhases.length > 0) {
      const projectPhases = templatePhases.map(tp => ({
        project_id: project.id,
        phase_number: tp.phase_number,
        data: tp.default_data || {},
        completed: false,
      }));
      
      const { error: phasesError } = await supabase
        .from('project_phases')
        .insert(projectPhases);
      
      if (phasesError) {
        logger.warn('[CreateProjectFromTemplate] Failed to create phases:', {
          error: phasesError.message,
          projectId: project.id,
        });
        // Don't fail the whole action, just log the warning
      } else {
        logger.info('[CreateProjectFromTemplate] Phases created:', {
          projectId: project.id,
          phasesCount: projectPhases.length,
        });
      }
    }
    
    logger.info('[CreateProjectFromTemplate] Project created:', {
      projectId: project.id,
      name: project.name,
      templateId,
    });
    
    return {
      output: {
        success: true,
        project_id: project.id,
        project,
        template_id: templateId,
        template_name: template.name,
        created_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[CreateProjectFromTemplate] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      name,
      templateId,
    });
    throw error;
  }
}

