import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';
import type { Opportunity } from '@/types/ops';
import type { Project } from '@/types/project';
import { createActivityFeedItem } from './activityFeed';

/**
 * Convert an opportunity to a project
 * @param supabase - Supabase client instance
 * @param opportunity - The opportunity to convert
 * @param ownerId - ID of the user creating the project
 * @param templateId - Optional template ID to use for project phases
 * @param memberIds - Optional array of user IDs to add as project members
 */
export async function convertOpportunityToProject(
  supabase: SupabaseClient,
  opportunity: Opportunity,
  ownerId: string,
  templateId?: string | null,
  memberIds?: string[]
): Promise<Project> {
  try {
    // Create project from opportunity
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        owner_id: ownerId,
        name: opportunity.name,
        description: `Converted from opportunity: ${opportunity.name}`,
        status: 'idea',
        company_id: opportunity.company_id,
        source: 'Converted',
        opportunity_id: opportunity.id,
        template_id: templateId || null,
      })
      .select()
      .single();

    if (projectError) {
      throw projectError;
    }

    // Create phases from template if provided
    if (templateId) {
      const { data: templatePhases, error: templatePhasesError } = await supabase
        .from('template_phases')
        .select('*')
        .eq('template_id', templateId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!templatePhasesError && templatePhases && templatePhases.length > 0) {
        const phaseInserts = templatePhases.map((templatePhase) => ({
          project_id: project.id,
          phase_number: templatePhase.phase_number,
          phase_name: templatePhase.phase_name,
          display_order: templatePhase.display_order,
          data: templatePhase.data || {},
          completed: false,
          is_active: true,
        }));

        await supabase.from('project_phases').insert(phaseInserts);
      }
    }

    // Add project members if provided
    if (memberIds && memberIds.length > 0) {
      const { createAdminSupabaseClient } = await import('@/lib/supabaseAdmin');
      const adminClient = createAdminSupabaseClient();
      
      const memberInserts = memberIds.map((userId) => ({
        project_id: project.id,
        user_id: userId,
        role: 'engineer' as const, // Default role for members added during conversion
      }));

      await adminClient.from('project_members').insert(memberInserts);
    }

    // Create activity feed item
    try {
      await createActivityFeedItem(supabase, {
        company_id: opportunity.company_id,
        related_entity_id: project.id,
        related_entity_type: 'project',
        event_type: 'project_created',
        message: `Project "${project.name}" was created from opportunity "${opportunity.name}"`,
      });
    } catch (activityError) {
      logger.error('Error creating activity feed item:', activityError);
      // Don't fail the request if activity feed creation fails
    }

    return project;
  } catch (error) {
    logger.error('Error converting opportunity to project:', error);
    throw error;
  }
}

