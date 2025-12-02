import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';

/**
 * Auto-create a lead when a contact is created
 * @param supabase - Supabase client instance
 * @param contactId - ID of the contact
 * @param companyId - ID of the company
 */
export async function createLeadFromContact(
  supabase: SupabaseClient,
  contactId: string,
  companyId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('leads')
      .insert({
        contact_id: contactId,
        company_id: companyId,
      });

    if (error) {
      // If it's a unique constraint violation, that's okay (lead already exists)
      if (error.code === '23505') {
        return; // Lead already exists, that's fine
      }
      
      // If the table doesn't exist (42P01), that's okay - leads feature may not be enabled
      // Check both error.code and error.message/error.error for robustness
      const errorMessage = error.message || (error as any).error || String(error);
      if (error.code === '42P01' || 
          errorMessage.includes('does not exist') || 
          (errorMessage.includes('relation') && errorMessage.includes('leads'))) {
        logger.warn('Leads table does not exist, skipping lead creation');
        return; // Table doesn't exist, skip silently
      }
      
      // For other errors, throw them
      throw error;
    }
  } catch (error: any) {
    // Handle "relation does not exist" errors gracefully
    // Check multiple possible error formats
    const errorMessage = error?.message || error?.error || String(error || '');
    if (error?.code === '42P01' || 
        errorMessage.includes('does not exist') || 
        (errorMessage.includes('relation') && errorMessage.includes('leads'))) {
      logger.warn('Leads table does not exist, skipping lead creation');
      return; // Table doesn't exist, skip silently
    }
    
    logger.error('Error creating lead from contact:', error);
    throw error;
  }
}

/**
 * Get all leads for a company
 * @param supabase - Supabase client instance
 * @param companyId - ID of the company
 */
export async function getLeadsForCompany(
  supabase: SupabaseClient,
  companyId: string
) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        contact:company_contacts(*)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      // If the table doesn't exist, return empty array
      const errorMessage = error.message || (error as any).error || String(error);
      if (error.code === '42P01' || 
          errorMessage.includes('does not exist') ||
          (errorMessage.includes('relation') && errorMessage.includes('leads'))) {
        logger.warn('Leads table does not exist, returning empty array');
        return [];
      }
      throw error;
    }

    return data || [];
  } catch (error: any) {
    // Handle "relation does not exist" errors gracefully
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      logger.warn('Leads table does not exist, returning empty array');
      return [];
    }
    
    logger.error('Error getting leads for company:', error);
    throw error;
  }
}

