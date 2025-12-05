import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/apiErrors';
import { validateFileUpload, sanitizeFilename, getMaxFileSize } from '@/lib/utils/fileValidation';
import { isValidUUID } from '@/lib/utils/inputSanitization';
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
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return badRequest('Invalid organization ID format');
    }

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

    const validTypes = ['logo', 'icon', 'logo_light', 'icon_light'];
    if (!validTypes.includes(type)) {
      return badRequest('Type must be "logo", "icon", "logo_light", or "icon_light"');
    }

    // Enhanced file validation with magic bytes verification
    // Use base type (logo or icon) for size limits
    const baseType = type.startsWith('logo') ? 'logo' : 'icon';
    const maxSize = getMaxFileSize('image', baseType as 'logo' | 'icon');
    const validation = await validateFileUpload(
      file,
      ['image'], // Allow all image types
      maxSize,
      true // Require magic bytes verification
    );

    if (!validation.valid) {
      return validation.error || badRequest('File validation failed');
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = sanitizeFilename(file.name);

    const adminClient = createAdminSupabaseClient();

    // Get current branding to delete old file if it exists
    const { data: organization } = await adminClient
      .from('organizations')
      .select('logo_url, icon_url, logo_light_url, icon_light_url')
      .eq('id', params.id)
      .single();

    if (organization) {
      const urlMap: Record<string, string | null> = {
        logo: organization.logo_url,
        icon: organization.icon_url,
        logo_light: organization.logo_light_url,
        icon_light: organization.icon_light_url,
      };
      const oldUrl = urlMap[type];
      
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

    // Create unique filename using sanitized name
    const fileExt = sanitizedFilename.split('.').pop()?.toLowerCase() || 'png';
    const timestamp = Date.now();
    // Use sanitized filename (already sanitized above)
    const fileName = `${params.id}/${type}-${timestamp}-${sanitizedFilename}`;

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
    const fieldMap: Record<string, string> = {
      logo: 'logo_url',
      icon: 'icon_url',
      logo_light: 'logo_light_url',
      icon_light: 'icon_light_url',
    };
    const updateField = fieldMap[type];
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

