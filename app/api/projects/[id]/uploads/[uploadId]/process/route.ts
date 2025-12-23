import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { processUploadedFile, isSupportedFileType } from '@/lib/uploads/fileProcessor';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';

export const dynamic = 'force-dynamic';

// Increase timeout for AI processing
export const maxDuration = 60; // 60 seconds

/**
 * POST /api/projects/[id]/uploads/[uploadId]/process
 * Trigger AI processing for an upload (text extraction + summary generation)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to process uploads');
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

    // Get upload details
    const { data: upload, error: uploadError } = await supabase
      .from('project_uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('project_id', projectId)
      .single();

    if (uploadError || !upload) {
      return notFound('Upload not found');
    }

    // Check if already processed
    if (upload.is_processed) {
      return NextResponse.json({
        message: 'Upload already processed',
        upload,
      });
    }

    // Check if file type is supported
    if (!upload.mime_type || !isSupportedFileType(upload.mime_type)) {
      // Mark as processed with error
      await supabase
        .from('project_uploads')
        .update({
          is_processed: true,
          processing_error: `Unsupported file type: ${upload.mime_type || 'unknown'}`,
        })
        .eq('id', uploadId);

      return badRequest(`Unsupported file type: ${upload.mime_type || 'unknown'}`);
    }

    // Get API key
    const apiKey = await getGeminiApiKey(supabase);
    if (!apiKey) {
      return internalError('AI processing is not configured. Please contact your administrator.');
    }

    logger.info(`[Upload Processing] Starting processing for upload ${uploadId}`);

    // Process the file
    const result = await processUploadedFile(
      upload.file_path,
      upload.mime_type,
      upload.file_name,
      apiKey
    );

    // Update the upload record with results
    const { data: updatedUpload, error: updateError } = await supabase
      .from('project_uploads')
      .update({
        extracted_text: result.extractedText || null,
        ai_summary: result.summary || null,
        is_processed: true,
        processing_error: result.error || null,
      })
      .eq('id', uploadId)
      .select(`
        *,
        uploader:users!project_uploads_uploaded_by_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (updateError) {
      logger.error('[Upload Processing] Failed to update upload record:', updateError);
      return internalError('Failed to save processing results', { error: updateError.message });
    }

    logger.info(`[Upload Processing] Completed processing for upload ${uploadId}`);

    return NextResponse.json({
      message: result.error ? 'Processing completed with errors' : 'Processing completed successfully',
      upload: updatedUpload,
    });
  } catch (error) {
    logger.error('Error in POST /api/projects/[id]/uploads/[uploadId]/process:', error);
    
    // Try to mark the upload as failed
    try {
      const supabase = await createServerSupabaseClient();
      const { id: projectId, uploadId } = params;
      
      await supabase
        .from('project_uploads')
        .update({
          is_processed: true,
          processing_error: error instanceof Error ? error.message : 'Unknown processing error',
        })
        .eq('id', uploadId)
        .eq('project_id', projectId);
    } catch (updateErr) {
      logger.error('Failed to mark upload as failed:', updateErr);
    }
    
    return internalError('Failed to process upload', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

