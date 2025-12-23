import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ProjectUploadUpdateInput } from '@/types/project';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/uploads/[uploadId]
 * Get a single upload with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view uploads');
    }

    const { id: projectId, uploadId } = params;

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User not found');
    }

    // Verify user is a project member
    const { data: membership, error: membershipError } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userData.id)
      .single();

    if (membershipError || !membership) {
      return unauthorized('You do not have access to this project');
    }

    // Get upload with uploader info
    const { data: upload, error: uploadError } = await supabase
      .from('project_uploads')
      .select(`
        *,
        uploader:users!project_uploads_uploaded_by_fkey(id, name, email, avatar_url)
      `)
      .eq('id', uploadId)
      .eq('project_id', projectId)
      .single();

    if (uploadError || !upload) {
      if (uploadError?.code === 'PGRST116') {
        return notFound('Upload not found');
      }
      logger.error('Error loading upload:', uploadError);
      return internalError('Failed to load upload', { error: uploadError?.message });
    }

    return NextResponse.json(upload);
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/uploads/[uploadId]:', error);
    return internalError('Failed to load upload', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * PATCH /api/projects/[id]/uploads/[uploadId]
 * Update upload metadata (description, tags)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to update uploads');
    }

    const { id: projectId, uploadId } = params;
    const body: ProjectUploadUpdateInput = await request.json();
    const { description, tags } = body;

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User not found');
    }

    // Verify user is a project member
    const { data: membership, error: membershipError } = await supabase
      .from('project_members')
      .select('id, role')
      .eq('project_id', projectId)
      .eq('user_id', userData.id)
      .single();

    if (membershipError || !membership) {
      return unauthorized('You do not have access to this project');
    }

    // Verify upload exists
    const { data: existingUpload, error: checkError } = await supabase
      .from('project_uploads')
      .select('id, uploaded_by')
      .eq('id', uploadId)
      .eq('project_id', projectId)
      .single();

    if (checkError || !existingUpload) {
      return notFound('Upload not found');
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    if (tags !== undefined) {
      updateData.tags = tags || [];
    }

    if (Object.keys(updateData).length === 0) {
      return badRequest('No valid fields to update');
    }

    // Update upload
    const { data: upload, error: updateError } = await supabase
      .from('project_uploads')
      .update(updateData)
      .eq('id', uploadId)
      .eq('project_id', projectId)
      .select(`
        *,
        uploader:users!project_uploads_uploaded_by_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (updateError) {
      logger.error('Error updating upload:', updateError);
      return internalError('Failed to update upload', { error: updateError.message });
    }

    return NextResponse.json(upload);
  } catch (error) {
    logger.error('Error in PATCH /api/projects/[id]/uploads/[uploadId]:', error);
    return internalError('Failed to update upload', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * DELETE /api/projects/[id]/uploads/[uploadId]
 * Delete an upload and its storage file
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to delete uploads');
    }

    const { id: projectId, uploadId } = params;

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User not found');
    }

    // Verify user is a project member
    const { data: membership, error: membershipError } = await supabase
      .from('project_members')
      .select('id, role')
      .eq('project_id', projectId)
      .eq('user_id', userData.id)
      .single();

    if (membershipError || !membership) {
      return unauthorized('You do not have access to this project');
    }

    // Get upload to check ownership and get file path
    const { data: upload, error: checkError } = await supabase
      .from('project_uploads')
      .select('id, uploaded_by, file_path')
      .eq('id', uploadId)
      .eq('project_id', projectId)
      .single();

    if (checkError || !upload) {
      return notFound('Upload not found');
    }

    // Check if user can delete (owner or admin)
    const isOwner = upload.uploaded_by === userData.id;
    const isAdmin = membership.role === 'admin' || membership.role === 'owner';

    if (!isOwner && !isAdmin) {
      return unauthorized('You can only delete your own uploads');
    }

    // Try to delete from storage
    if (upload.file_path) {
      try {
        // Extract file path from URL
        const urlParts = upload.file_path.split('/');
        const bucketIndex = urlParts.findIndex((part: string) => part === 'file_uploads');
        if (bucketIndex !== -1) {
          const storagePath = urlParts.slice(bucketIndex + 1).join('/');
          const { error: storageError } = await supabase.storage
            .from('file_uploads')
            .remove([storagePath]);
          
          if (storageError) {
            logger.warn('Failed to delete file from storage:', storageError);
            // Continue with database deletion even if storage deletion fails
          }
        }
      } catch (storageErr) {
        logger.warn('Error deleting file from storage:', storageErr);
        // Continue with database deletion
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('project_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('project_id', projectId);

    if (deleteError) {
      logger.error('Error deleting upload:', deleteError);
      return internalError('Failed to delete upload', { error: deleteError.message });
    }

    logger.info(`Upload ${uploadId} deleted from project ${projectId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/projects/[id]/uploads/[uploadId]:', error);
    return internalError('Failed to delete upload', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

