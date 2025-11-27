import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';
import type { ActivityFeedItem, ActivityEventType, ActivityEntityType } from '@/types/ops';

export interface CreateActivityFeedItemParams {
  company_id: string;
  related_entity_id: string | null;
  related_entity_type: ActivityEntityType;
  event_type: ActivityEventType;
  message: string;
}

/**
 * Create an activity feed item
 * @param supabase - Supabase client instance
 * @param params - Activity feed item parameters
 */
export async function createActivityFeedItem(
  supabase: SupabaseClient,
  params: CreateActivityFeedItemParams
): Promise<ActivityFeedItem> {
  try {
    const { data, error } = await supabase
      .from('activity_feed_items')
      .insert({
        company_id: params.company_id,
        related_entity_id: params.related_entity_id,
        related_entity_type: params.related_entity_type,
        event_type: params.event_type,
        message: params.message,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error creating activity feed item:', error);
    throw error;
  }
}

/**
 * Get activity feed for a company (reverse chronological)
 * @param supabase - Supabase client instance
 * @param companyId - ID of the company
 * @param limit - Maximum number of items to return (default: 50)
 * @param offset - Number of items to skip (default: 0)
 */
export async function getActivityFeedForCompany(
  supabase: SupabaseClient,
  companyId: string,
  limit: number = 50,
  offset: number = 0
) {
  try {
    // Get activity feed items
    const { data: activities, error: activitiesError } = await supabase
      .from('activity_feed_items')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (activitiesError) {
      throw activitiesError;
    }

    if (!activities || activities.length === 0) {
      return [];
    }

    // Enrich activities with related entity details
    logger.info(`Enriching ${activities.length} activity feed items`);
    const activitiesWithDetails = await Promise.all(
      activities.map(async (activity) => {
        const activityTime = new Date(activity.created_at).getTime();
        const timeWindow = 10 * 60 * 1000; // 10 minutes window for matching (increased for reliability)
        
        logger.debug(`Processing activity: ${activity.event_type}, message: ${activity.message}, related_entity_id: ${activity.related_entity_id}`);

        // For interaction_created events, fetch interaction details by matching timestamp
        if (activity.event_type === 'interaction_created' && activity.related_entity_id) {
          try {
            // Get interactions created around the same time as the activity feed item (within 5 minutes)
            const activityDate = new Date(activity.created_at);
            const beforeTime = new Date(activityDate.getTime() - timeWindow).toISOString();
            const afterTime = new Date(activityDate.getTime() + timeWindow).toISOString();

            const { data: interactions } = await supabase
              .from('contact_interactions')
              .select(`
                id, 
                interaction_type, 
                subject, 
                notes, 
                interaction_date,
                created_by,
                created_at,
                created_user:users!contact_interactions_created_by_fkey(id, name, email)
              `)
              .eq('contact_id', activity.related_entity_id)
              .gte('created_at', beforeTime)
              .lte('created_at', afterTime)
              .order('created_at', { ascending: false })
              .limit(5);

            if (interactions && interactions.length > 0) {
              logger.debug(`Found ${interactions.length} interactions for contact ${activity.related_entity_id}`);
              // Find the interaction created closest to the activity feed item
              const matchingInteraction = interactions.reduce((closest, interaction) => {
                const interactionTime = new Date(interaction.created_at).getTime();
                const closestTime = closest ? new Date(closest.created_at).getTime() : Infinity;
                return Math.abs(interactionTime - activityTime) < Math.abs(closestTime - activityTime) 
                  ? interaction 
                  : closest;
              }, interactions[0]);

              if (matchingInteraction) {
                logger.debug(`Matched interaction: ${matchingInteraction.id}`);
                return {
                  ...activity,
                  interaction_details: matchingInteraction,
                };
              }
            } else {
              logger.debug(`No interactions found for contact ${activity.related_entity_id}`);
            }
          } catch (err) {
            logger.error('Could not fetch interaction details:', err);
          }
        }

        // For tag_added events, fetch tag details by matching timestamp
        if (activity.event_type === 'tag_added' && activity.related_entity_id) {
          try {
            // Extract tag name from message (format: Tag "X" added...)
            const tagMatch = activity.message.match(/Tag "([^"]+)"/);
            if (tagMatch) {
              const tagName = tagMatch[1];
              // Get tags created around the same time as the activity feed item
              const activityDate = new Date(activity.created_at);
              const beforeTime = new Date(activityDate.getTime() - timeWindow).toISOString();
              const afterTime = new Date(activityDate.getTime() + timeWindow).toISOString();

              const { data: tags } = await supabase
                .from('contact_tags')
                .select('id, tag_name, created_at')
                .eq('contact_id', activity.related_entity_id)
                .eq('tag_name', tagName)
                .gte('created_at', beforeTime)
                .lte('created_at', afterTime)
                .order('created_at', { ascending: false })
                .limit(5);

              if (tags && tags.length > 0) {
                logger.debug(`Found ${tags.length} tags matching "${tagName}"`);
                // Find the tag created closest to the activity feed item
                const matchingTag = tags.reduce((closest, tag) => {
                  const tagTime = new Date(tag.created_at).getTime();
                  const closestTime = closest ? new Date(closest.created_at).getTime() : Infinity;
                  return Math.abs(tagTime - activityTime) < Math.abs(closestTime - activityTime) 
                    ? tag 
                    : closest;
                }, tags[0]);

                if (matchingTag) {
                  logger.debug(`Matched tag: ${matchingTag.tag_name}`);
                  return {
                    ...activity,
                    tag_details: matchingTag,
                  };
                }
              } else {
                logger.debug(`No tags found matching "${tagName}"`);
              }
            } else {
              logger.debug(`Could not extract tag name from message: ${activity.message}`);
            }
          } catch (err) {
            logger.error('Could not fetch tag details:', err);
          }
        }

        // For attachment uploads, fetch attachment details by matching timestamp
        if ((activity.event_type === 'attachment_uploaded' || 
            (activity.event_type === 'contact_updated' && activity.message.includes('Attachment'))) &&
            activity.related_entity_id) {
          try {
            // Extract filename from message (format: Attachment "X" uploaded...)
            const fileMatch = activity.message.match(/Attachment "([^"]+)"/);
            if (fileMatch) {
              const fileName = fileMatch[1];
              // Get attachments created around the same time as the activity feed item
              const activityDate = new Date(activity.created_at);
              const beforeTime = new Date(activityDate.getTime() - timeWindow).toISOString();
              const afterTime = new Date(activityDate.getTime() + timeWindow).toISOString();

              const { data: attachments } = await supabase
                .from('contact_attachments')
                .select(`
                  id,
                  file_name,
                  file_path,
                  file_size,
                  file_type,
                  uploaded_by,
                  created_at,
                  uploaded_user:users!contact_attachments_uploaded_by_fkey(id, name, email)
                `)
                .eq('contact_id', activity.related_entity_id)
                .eq('file_name', fileName)
                .gte('created_at', beforeTime)
                .lte('created_at', afterTime)
                .order('created_at', { ascending: false })
                .limit(5);

              if (attachments && attachments.length > 0) {
                logger.debug(`Found ${attachments.length} attachments matching "${fileName}"`);
                // Find the attachment created closest to the activity feed item
                const matchingAttachment = attachments.reduce((closest, attachment) => {
                  const attachmentTime = new Date(attachment.created_at).getTime();
                  const closestTime = closest ? new Date(closest.created_at).getTime() : Infinity;
                  return Math.abs(attachmentTime - activityTime) < Math.abs(closestTime - activityTime) 
                    ? attachment 
                    : closest;
                }, attachments[0]);

                if (matchingAttachment) {
                  logger.debug(`Matched attachment: ${matchingAttachment.file_name}`);
                  return {
                    ...activity,
                    attachment_details: matchingAttachment,
                  };
                }
              } else {
                logger.debug(`No attachments found matching "${fileName}"`);
              }
            } else {
              logger.debug(`Could not extract filename from message: ${activity.message}`);
            }
          } catch (err) {
            logger.error('Could not fetch attachment details:', err);
          }
        }

        return activity;
      })
    );

    return activitiesWithDetails;
  } catch (error) {
    logger.error('Error getting activity feed for company:', error);
    throw error;
  }
}

