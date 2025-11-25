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
      if (error.code !== '23505') {
        throw error;
      }
    }
  } catch (error) {
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
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error getting leads for company:', error);
    throw error;
  }
}

