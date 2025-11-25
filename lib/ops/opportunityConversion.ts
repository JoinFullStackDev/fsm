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
 */
export async function convertOpportunityToProject(
  supabase: SupabaseClient,
  opportunity: Opportunity,
  ownerId: string
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
      })
      .select()
      .single();

    if (projectError) {
      throw projectError;
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

