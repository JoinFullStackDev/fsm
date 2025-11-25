import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { createActivityFeedItem } from '@/lib/ops/activityFeed';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view interactions');
    }

    const { id: contactId } = params;

    // Verify contact exists
    const { data: contact, error: contactError } = await supabase
      .from('company_contacts')
      .select('id')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      if (contactError?.code === 'PGRST116') {
        return notFound('Contact not found');
      }
      logger.error('Error checking contact:', contactError);
      return internalError('Failed to check contact', { error: contactError?.message });
    }

    // Get interactions with creator info
    const { data: interactions, error: interactionsError } = await supabase
      .from('contact_interactions')
      .select(`
        *,
        created_user:users!contact_interactions_created_by_fkey(id, name, email)
      `)
      .eq('contact_id', contactId)
      .order('interaction_date', { ascending: false });

    if (interactionsError) {
      logger.error('Error loading interactions:', interactionsError);
      return internalError('Failed to load interactions', { error: interactionsError.message });
    }

    return NextResponse.json(interactions || []);
  } catch (error) {
    logger.error('Error in GET /api/ops/contacts/[id]/interactions:', error);
    return internalError('Failed to load interactions', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create interactions');
    }

    const { id: contactId } = params;
    const body = await request.json();
    const { interaction_type, subject, notes, interaction_date } = body;

    // Validate
    if (!interaction_type || typeof interaction_type !== 'string') {
      return badRequest('Interaction type is required');
    }
    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return badRequest('Notes are required');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Verify contact exists and get company_id
    const { data: contact, error: contactError } = await supabase
      .from('company_contacts')
      .select('id, company_id, first_name, last_name')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      if (contactError?.code === 'PGRST116') {
        return notFound('Contact not found');
      }
      logger.error('Error checking contact:', contactError);
      return internalError('Failed to check contact', { error: contactError?.message });
    }

    // Create interaction
    const { data: interaction, error: interactionError } = await supabase
      .from('contact_interactions')
      .insert({
        contact_id: contactId,
        interaction_type: interaction_type.trim(),
        subject: subject?.trim() || null,
        notes: notes.trim(),
        interaction_date: interaction_date || new Date().toISOString(),
        created_by: userData.id,
      })
      .select()
      .single();

    if (interactionError) {
      logger.error('Error creating interaction:', interactionError);
      return internalError('Failed to create interaction', { error: interactionError.message });
    }

    // Update contact's last_contact_date
    await supabase
      .from('company_contacts')
      .update({ last_contact_date: interaction.interaction_date })
      .eq('id', contactId);

    // Create activity feed item with enhanced message including user info
    try {
      // Get user info for the activity feed
      const { data: userInfo } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', userData.id)
        .single();

      const userName = userInfo?.name || userInfo?.email || 'Unknown user';
      const interactionDate = interaction_date 
        ? new Date(interaction_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'now';

      // Build a more descriptive message
      let message = `${interaction_type} interaction logged for contact ${contact.first_name} ${contact.last_name} by ${userName} on ${interactionDate}`;
      if (subject) {
        message += `: "${subject}"`;
      }

      const activityResult = await createActivityFeedItem(supabase, {
        company_id: contact.company_id,
        related_entity_id: contactId,
        related_entity_type: 'contact',
        event_type: 'interaction_created',
        message: message,
      });
      logger.info('Created activity feed item for interaction:', activityResult.id);
    } catch (activityError: any) {
      logger.error('Error creating activity feed item for interaction:', {
        error: activityError,
        message: activityError?.message,
        code: activityError?.code,
        details: activityError?.details,
        hint: activityError?.hint,
      });
      // Log to console for debugging
      console.error('[INTERACTION ACTIVITY FEED ERROR]', activityError);
      // Don't fail the request, but log the error
    }

    return NextResponse.json(interaction, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/contacts/[id]/interactions:', error);
    return internalError('Failed to create interaction', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

