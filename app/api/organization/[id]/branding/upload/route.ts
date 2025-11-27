import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/organization/[id]/branding/upload
 * Upload organization branding (logo or icon)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in');
    }

    // Verify user has access to this organization
    const userOrgId = await getUserOrganizationId(supabase, session.user.id);
    if (!userOrgId || userOrgId !== params.id) {
      return forbidden('Access denied to this organization');
    }

    // Get user role - only admins can upload branding
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', session.user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return forbidden('Admin access required');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file) {
      return badRequest('No file provided');
    }

    if (type !== 'logo' && type !== 'icon') {
      return badRequest('Type must be "logo" or "icon"');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return badRequest('File must be an image');
    }

    // Validate file size
    const maxSize = type === 'logo' ? 2 * 1024 * 1024 : 1 * 1024 * 1024; // 2MB for logo, 1MB for icon
    if (file.size > maxSize) {
      return badRequest(`File size must be less than ${maxSize / 1024 / 1024}MB`);
    }

    const adminClient = createAdminSupabaseClient();

    // Get current branding to delete old file if it exists
    const { data: organization } = await adminClient
      .from('organizations')
      .select('logo_url, icon_url')
      .eq('id', params.id)
      .single();

    if (organization) {
      const oldUrl = type === 'logo' ? organization.logo_url : organization.icon_url;
      
      if (oldUrl) {
        // Extract file path from URL
        try {
          const urlParts = oldUrl.split('/');
          const fileName = urlParts.slice(-2).join('/'); // Get organization_id/filename
          
          // Delete old file from storage
          const { error: deleteError } = await adminClient.storage
            .from('organization_assets')
            .remove([fileName]);

          if (deleteError) {
            logger.warn('[Branding] Failed to delete old file from storage:', deleteError);
            // Continue anyway - we'll upload the new file
          }
        } catch (err) {
          logger.warn('[Branding] Error parsing old file URL:', err);
          // Continue anyway
        }
      }
    }

    // Create unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${params.id}/${type}-${timestamp}-${sanitizedName}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('organization_assets')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      logger.error('[Branding] Upload error:', uploadError);
      return internalError('Failed to upload file', { error: uploadError.message });
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from('organization_assets')
      .getPublicUrl(fileName);

    // Update organization with new URL
    const updateField = type === 'logo' ? 'logo_url' : 'icon_url';
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({ [updateField]: publicUrl })
      .eq('id', params.id);

    if (updateError) {
      logger.error('[Branding] Error updating organization:', updateError);
      // Try to clean up uploaded file
      await adminClient.storage.from('organization_assets').remove([fileName]);
      return internalError('Failed to update organization', { error: updateError.message });
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    logger.error('Error in POST /api/organization/[id]/branding/upload:', error);
    return internalError('Failed to upload branding', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

