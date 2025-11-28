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
      return unauthorized('You must be logged in to view contact tags');
    }

    const { id: contactId } = params;

    // Verify contact exists and get company_id
    const { data: contact, error: contactError } = await supabase
      .from('company_contacts')
      .select('id, company_id')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      if (contactError?.code === 'PGRST116') {
        return notFound('Contact not found');
      }
      logger.error('Error checking contact:', contactError);
      return internalError('Failed to check contact', { error: contactError?.message });
    }

    // Get tags
    const { data: tags, error: tagsError } = await supabase
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contactId)
      .order('tag_name', { ascending: true });

    if (tagsError) {
      logger.error('Error loading tags:', tagsError);
      return internalError('Failed to load tags', { error: tagsError.message });
    }

    return NextResponse.json(tags || []);
  } catch (error) {
    logger.error('Error in GET /api/ops/contacts/[id]/tags:', error);
    return internalError('Failed to load tags', { error: error instanceof Error ? error.message : 'Unknown error' });
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
      return unauthorized('You must be logged in to add tags');
    }

    const { id: contactId } = params;
    const body = await request.json();
    const { tag_name } = body;

    if (!tag_name || typeof tag_name !== 'string' || tag_name.trim().length === 0) {
      return badRequest('Tag name is required');
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

    // Add tag (upsert to handle duplicates gracefully)
    const { data: tag, error: tagError } = await supabase
      .from('contact_tags')
      .insert({
        contact_id: contactId,
        tag_name: tag_name.trim(),
      })
      .select()
      .single();

    if (tagError) {
      // If duplicate, return existing tag
      if (tagError.code === '23505') {
        const { data: existingTag } = await supabase
          .from('contact_tags')
          .select('*')
          .eq('contact_id', contactId)
          .eq('tag_name', tag_name.trim())
          .single();
        return NextResponse.json(existingTag);
      }
      logger.error('Error adding tag:', tagError);
      return internalError('Failed to add tag', { error: tagError.message });
    }

    // Create activity feed item with user info
    try {
      // Get user info for the activity feed
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('auth_id', session.user.id)
        .single();

      const userName = userData?.name || userData?.email || 'Unknown user';
      const activityResult = await createActivityFeedItem(supabase, {
        company_id: contact.company_id,
        related_entity_id: contactId,
        related_entity_type: 'contact',
        event_type: 'tag_added',
        message: `Tag "${tag_name.trim()}" added to contact ${contact.first_name} ${contact.last_name} by ${userName}`,
      });
      logger.info('Created activity feed item for tag:', activityResult.id);
    } catch (activityError: any) {
      logger.error('Error creating activity feed item for tag:', {
        error: activityError,
        message: activityError?.message,
        code: activityError?.code,
        details: activityError?.details,
        hint: activityError?.hint,
      });
      // Don't fail the request, but log the error
    }

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/contacts/[id]/tags:', error);
    return internalError('Failed to add tag', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to remove tags');
    }

    const { id: contactId } = params;
    const { searchParams } = new URL(request.url);
    const tagName = searchParams.get('tag_name');

    if (!tagName) {
      return badRequest('Tag name is required');
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

    // Remove tag
    const { error: deleteError } = await supabase
      .from('contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .eq('tag_name', tagName);

    if (deleteError) {
      logger.error('Error removing tag:', deleteError);
      return internalError('Failed to remove tag', { error: deleteError.message });
    }

    // Create activity feed item
    try {
      await createActivityFeedItem(supabase, {
        company_id: contact.company_id,
        related_entity_id: contactId,
        related_entity_type: 'contact',
        event_type: 'tag_removed',
        message: `Tag "${tagName}" removed from contact ${contact.first_name} ${contact.last_name}`,
      });
    } catch (activityError) {
      logger.error('Error creating activity feed item:', activityError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/ops/contacts/[id]/tags:', error);
    return internalError('Failed to remove tag', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

