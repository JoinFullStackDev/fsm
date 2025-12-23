import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ProjectUploadCreateInput } from '@/types/project';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/uploads
 * List all uploads for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view uploads');
    }

    const { id: projectId } = params;

    // Verify project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      if (projectError?.code === 'PGRST116') {
        return notFound('Project not found');
      }
      logger.error('Error checking project:', projectError);
      return internalError('Failed to check project', { error: projectError?.message });
    }

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

    // Get uploads with uploader info
    const { data: uploads, error: uploadsError } = await supabase
      .from('project_uploads')
      .select(`
        *,
        uploader:users!project_uploads_uploaded_by_fkey(id, name, email, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (uploadsError) {
      logger.error('Error loading uploads:', uploadsError);
      return internalError('Failed to load uploads', { error: uploadsError.message });
    }

    return NextResponse.json({
      uploads: uploads || [],
      total: uploads?.length || 0,
    });
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/uploads:', error);
    return internalError('Failed to load uploads', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * POST /api/projects/[id]/uploads
 * Create a new upload record (after file is uploaded to storage)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to upload files');
    }

    const { id: projectId } = params;
    const body: ProjectUploadCreateInput = await request.json();
    const { file_name, file_path, file_size, file_type, mime_type, description, tags } = body;

    // Validate required fields
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

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      if (projectError?.code === 'PGRST116') {
        return notFound('Project not found');
      }
      logger.error('Error checking project:', projectError);
      return internalError('Failed to check project', { error: projectError?.message });
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

    // Create upload record
    const { data: upload, error: uploadError } = await supabase
      .from('project_uploads')
      .insert({
        project_id: projectId,
        file_name: file_name.trim(),
        file_path: file_path.trim(),
        file_size: file_size || null,
        file_type: file_type || null,
        mime_type: mime_type || null,
        description: description?.trim() || null,
        tags: tags || [],
        uploaded_by: userData.id,
        is_processed: false,
      })
      .select(`
        *,
        uploader:users!project_uploads_uploaded_by_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (uploadError) {
      logger.error('Error creating upload record:', uploadError);
      return internalError('Failed to create upload record', { error: uploadError.message });
    }

    logger.info(`Upload created for project ${projectId}: ${file_name}`);

    return NextResponse.json(upload, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/projects/[id]/uploads:', error);
    return internalError('Failed to create upload', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

