/**
 * Contact Actions
 * Create, update contacts and manage tags via workflow automation
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { interpolateTemplate, interpolateObject, getNestedValue } from '../templating';
import type { 
  CreateContactConfig, 
  UpdateContactConfig, 
  TagConfig, 
  WorkflowContext 
} from '@/types/workflows';
import logger from '@/lib/utils/logger';

/**
 * Execute create contact action
 * 
 * @param config - Contact creation configuration
 * @param context - Workflow context
 * @returns Action result with created contact details
 */
export async function executeCreateContact(
  config: CreateContactConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const contactConfig = config as CreateContactConfig;
  const supabase = createAdminSupabaseClient();
  
  // Get company ID from config or context
  let companyId: string | undefined;
  
  if (contactConfig.company_id) {
    companyId = interpolateTemplate(contactConfig.company_id, context);
  } else if (contactConfig.company_field) {
    const fieldValue = getNestedValue(context, contactConfig.company_field);
    companyId = typeof fieldValue === 'string' ? fieldValue : undefined;
  }
  
  if (!companyId) {
    throw new Error('No company ID found for contact creation');
  }
  
  // Interpolate text fields
  const firstName = interpolateTemplate(contactConfig.first_name, context);
  const lastName = interpolateTemplate(contactConfig.last_name, context);
  const email = contactConfig.email
    ? interpolateTemplate(contactConfig.email, context)
    : null;
  
  // Build contact data
  const contactData: Record<string, unknown> = {
    company_id: companyId,
    first_name: firstName,
    last_name: lastName,
    email,
    status: 'active',
  };
  
  // Add additional fields if specified
  if (contactConfig.additional_fields) {
    const interpolatedFields = interpolateObject(contactConfig.additional_fields, context);
    Object.assign(contactData, interpolatedFields);
  }
  
  logger.info('[CreateContact] Creating contact:', {
    companyId,
    firstName,
    lastName,
  });
  
  try {
    const { data: contact, error } = await supabase
      .from('company_contacts')
      .insert(contactData)
      .select()
      .single();
    
    if (error) {
      logger.error('[CreateContact] Failed to create contact:', {
        error: error.message,
        companyId,
      });
      throw new Error(`Failed to create contact: ${error.message}`);
    }
    
    logger.info('[CreateContact] Contact created:', {
      contactId: contact.id,
      name: `${contact.first_name} ${contact.last_name}`,
    });
    
    return {
      output: {
        success: true,
        contact_id: contact.id,
        contact,
        created_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[CreateContact] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId,
    });
    throw error;
  }
}

/**
 * Execute update contact action
 * 
 * @param config - Contact update configuration
 * @param context - Workflow context
 * @returns Action result with updated contact details
 */
export async function executeUpdateContact(
  config: UpdateContactConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const contactConfig = config as UpdateContactConfig;
  const supabase = createAdminSupabaseClient();
  
  // Get contact ID from config or context
  let contactId: string | undefined;
  
  if (contactConfig.contact_id) {
    contactId = interpolateTemplate(contactConfig.contact_id, context);
  } else if (contactConfig.contact_field) {
    const fieldValue = getNestedValue(context, contactConfig.contact_field);
    contactId = typeof fieldValue === 'string' ? fieldValue : undefined;
  }
  
  if (!contactId) {
    throw new Error('No contact ID found for contact update');
  }
  
  // Interpolate update values
  const updates = interpolateObject(contactConfig.updates, context) as Record<string, unknown>;
  
  // Add updated_at timestamp
  updates.updated_at = new Date().toISOString();
  
  if (Object.keys(updates).length === 1) {
    // Only updated_at
    logger.warn('[UpdateContact] No updates specified');
    return {
      output: {
        success: false,
        skipped: true,
        reason: 'No updates specified',
        contact_id: contactId,
      },
    };
  }
  
  logger.info('[UpdateContact] Updating contact:', {
    contactId,
    updates: Object.keys(updates).filter(k => k !== 'updated_at'),
  });
  
  try {
    const { data: contact, error } = await supabase
      .from('company_contacts')
      .update(updates)
      .eq('id', contactId)
      .select()
      .single();
    
    if (error) {
      logger.error('[UpdateContact] Failed to update contact:', {
        error: error.message,
        contactId,
      });
      throw new Error(`Failed to update contact: ${error.message}`);
    }
    
    logger.info('[UpdateContact] Contact updated:', {
      contactId: contact.id,
      updates: Object.keys(updates).filter(k => k !== 'updated_at'),
    });
    
    return {
      output: {
        success: true,
        contact_id: contact.id,
        updates,
        contact,
        updated_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[UpdateContact] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contactId,
    });
    throw error;
  }
}

/**
 * Execute add tag action
 * 
 * @param config - Tag configuration
 * @param context - Workflow context
 * @returns Action result with tag details
 */
export async function executeAddTag(
  config: TagConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const tagConfig = config as TagConfig;
  const supabase = createAdminSupabaseClient();
  
  // Get entity ID from context
  const entityId = getNestedValue(context, tagConfig.entity_field);
  if (!entityId || typeof entityId !== 'string') {
    throw new Error(`No entity ID found at ${tagConfig.entity_field}`);
  }
  
  // Interpolate tag name
  const tagName = interpolateTemplate(tagConfig.tag_name, context);
  
  // Determine table based on entity type
  const tableName = tagConfig.entity_type === 'contact' ? 'contact_tags' : 'company_tags';
  const idColumn = tagConfig.entity_type === 'contact' ? 'contact_id' : 'company_id';
  
  logger.info('[AddTag] Adding tag:', {
    entityType: tagConfig.entity_type,
    entityId,
    tagName,
  });
  
  try {
    // Check if tag already exists
    const { data: existingTag } = await supabase
      .from(tableName)
      .select('id')
      .eq(idColumn, entityId)
      .eq('tag_name', tagName)
      .single();
    
    if (existingTag) {
      logger.info('[AddTag] Tag already exists:', {
        entityId,
        tagName,
      });
      return {
        output: {
          success: true,
          skipped: true,
          reason: 'Tag already exists',
          tag_id: existingTag.id,
          tag_name: tagName,
        },
      };
    }
    
    // Create the tag
    const { data: tag, error } = await supabase
      .from(tableName)
      .insert({
        [idColumn]: entityId,
        tag_name: tagName,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('[AddTag] Failed to add tag:', {
        error: error.message,
        entityId,
        tagName,
      });
      throw new Error(`Failed to add tag: ${error.message}`);
    }
    
    logger.info('[AddTag] Tag added:', {
      tagId: tag.id,
      tagName,
    });
    
    return {
      output: {
        success: true,
        tag_id: tag.id,
        tag_name: tagName,
        entity_type: tagConfig.entity_type,
        entity_id: entityId,
        created_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[AddTag] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      entityId,
      tagName,
    });
    throw error;
  }
}

/**
 * Execute remove tag action
 * 
 * @param config - Tag configuration
 * @param context - Workflow context
 * @returns Action result with removal details
 */
export async function executeRemoveTag(
  config: TagConfig | unknown,
  context: WorkflowContext
): Promise<{ output: unknown }> {
  const tagConfig = config as TagConfig;
  const supabase = createAdminSupabaseClient();
  
  // Get entity ID from context
  const entityId = getNestedValue(context, tagConfig.entity_field);
  if (!entityId || typeof entityId !== 'string') {
    throw new Error(`No entity ID found at ${tagConfig.entity_field}`);
  }
  
  // Interpolate tag name
  const tagName = interpolateTemplate(tagConfig.tag_name, context);
  
  // Determine table based on entity type
  const tableName = tagConfig.entity_type === 'contact' ? 'contact_tags' : 'company_tags';
  const idColumn = tagConfig.entity_type === 'contact' ? 'contact_id' : 'company_id';
  
  logger.info('[RemoveTag] Removing tag:', {
    entityType: tagConfig.entity_type,
    entityId,
    tagName,
  });
  
  try {
    const { error, count } = await supabase
      .from(tableName)
      .delete()
      .eq(idColumn, entityId)
      .eq('tag_name', tagName);
    
    if (error) {
      logger.error('[RemoveTag] Failed to remove tag:', {
        error: error.message,
        entityId,
        tagName,
      });
      throw new Error(`Failed to remove tag: ${error.message}`);
    }
    
    if (count === 0) {
      logger.info('[RemoveTag] Tag did not exist:', {
        entityId,
        tagName,
      });
      return {
        output: {
          success: true,
          skipped: true,
          reason: 'Tag did not exist',
          tag_name: tagName,
        },
      };
    }
    
    logger.info('[RemoveTag] Tag removed:', {
      entityId,
      tagName,
    });
    
    return {
      output: {
        success: true,
        tag_name: tagName,
        entity_type: tagConfig.entity_type,
        entity_id: entityId,
        removed_at: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('[RemoveTag] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      entityId,
      tagName,
    });
    throw error;
  }
}

