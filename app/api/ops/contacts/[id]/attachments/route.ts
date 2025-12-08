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
      return unauthorized('You must be logged in to view attachments');
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

    // Get attachments with uploader info
    const { data: attachments, error: attachmentsError } = await supabase
      .from('contact_attachments')
      .select(`
        *,
        uploaded_user:users!contact_attachments_uploaded_by_fkey(id, name, email)
      `)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (attachmentsError) {
      logger.error('Error loading attachments:', attachmentsError);
      return internalError('Failed to load attachments', { error: attachmentsError.message });
    }

    return NextResponse.json(attachments || []);
  } catch (error) {
    logger.error('Error in GET /api/ops/contacts/[id]/attachments:', error);
    return internalError('Failed to load attachments', { error: error instanceof Error ? error.message : 'Unknown error' });
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
      return unauthorized('You must be logged in to upload attachments');
    }

    const { id: contactId } = params;
    const body = await request.json();
    const { file_name, file_path, file_size, file_type } = body;

    // Validate
    if (!file_name || typeof file_name !== 'string' || file_name.trim().length === 0) {
      return badRequest('File name is required');
    }
    if (!file_path || typeof file_path !== 'string' || file_path.trim().length === 0) {
      return badRequest('File path is required');
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

    // Create attachment record
    const { data: attachment, error: attachmentError } = await supabase
      .from('contact_attachments')
      .insert({
        contact_id: contactId,
        file_name: file_name.trim(),
        file_path: file_path.trim(),
        file_size: file_size || null,
        file_type: file_type || null,
        uploaded_by: userData.id,
      })
      .select()
      .single();

    if (attachmentError) {
      logger.error('Error creating attachment:', attachmentError);
      return internalError('Failed to create attachment', { error: attachmentError.message });
    }

    // Create activity feed item for attachment upload
    try {
      const { data: userInfo } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', userData.id)
        .single();

      const userName = userInfo?.name || userInfo?.email || 'Unknown user';
      const activityResult = await createActivityFeedItem(supabase, {
        company_id: contact.company_id,
        related_entity_id: contactId,
        related_entity_type: 'contact',
        event_type: 'attachment_uploaded',
        message: `Attachment "${file_name.trim()}" uploaded to contact ${contact.first_name} ${contact.last_name} by ${userName}`,
      });
      if (activityResult) {
        logger.info('Created activity feed item for attachment:', activityResult.id);
      }
    } catch (activityError) {
      const errorObj = activityError as { message?: string; code?: string; details?: unknown; hint?: string };
      logger.error('Error creating activity feed item for attachment:', {
        error: activityError,
        message: errorObj?.message,
        code: errorObj?.code,
        details: errorObj?.details,
        hint: errorObj?.hint,
      });
      // Don't fail the request, but log the error
    }

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/contacts/[id]/attachments:', error);
    return internalError('Failed to create attachment', { error: error instanceof Error ? error.message : 'Unknown error' });
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
      return unauthorized('You must be logged in to delete attachments');
    }

    const { id: contactId } = params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachment_id');

    if (!attachmentId) {
      return badRequest('Attachment ID is required');
    }

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

    // Delete attachment
    const { error: deleteError } = await supabase
      .from('contact_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('contact_id', contactId);

    if (deleteError) {
      logger.error('Error deleting attachment:', deleteError);
      return internalError('Failed to delete attachment', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/ops/contacts/[id]/attachments:', error);
    return internalError('Failed to delete attachment', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

