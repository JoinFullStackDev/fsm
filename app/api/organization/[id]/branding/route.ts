import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organization/[id]/branding
 * Get organization branding (logo and icon URLs)
 */
export async function GET(
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

    const adminClient = createAdminSupabaseClient();
    const { data: organization, error } = await adminClient
      .from('organizations')
      .select('logo_url, icon_url, logo_light_url, icon_light_url')
      .eq('id', params.id)
      .single();

    if (error || !organization) {
      return notFound('Organization not found');
    }

    return NextResponse.json({
      logo_url: organization.logo_url,
      icon_url: organization.icon_url,
      logo_light_url: organization.logo_light_url,
      icon_light_url: organization.icon_light_url,
    });
  } catch (error) {
    logger.error('Error in GET /api/organization/[id]/branding:', error);
    return internalError('Failed to load branding', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/organization/[id]/branding
 * Remove organization branding (logo or icon)
 */
export async function DELETE(
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

    const body = await request.json();
    const { type } = body;

    const validTypes = ['logo', 'icon', 'logo_light', 'icon_light'];
    if (!validTypes.includes(type)) {
      return badRequest('Type must be "logo", "icon", "logo_light", or "icon_light"');
    }

    const adminClient = createAdminSupabaseClient();

    // Get current branding to delete file from storage
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
      const urlToDelete = urlMap[type];
      
      if (urlToDelete) {
        // Extract file path from URL
        try {
          const urlParts = urlToDelete.split('/');
          const fileName = urlParts.slice(-2).join('/'); // Get organization_id/filename
          
          // Delete from storage
          const { error: deleteError } = await adminClient.storage
            .from('organization_assets')
            .remove([fileName]);

          if (deleteError) {
            logger.warn('[Branding] Failed to delete file from storage:', deleteError);
            // Continue anyway - we'll still remove the URL from the database
          }
        } catch (err) {
          logger.warn('[Branding] Error parsing file URL:', err);
          // Continue anyway
        }
      }
    }

    // Update organization to remove the URL
    const fieldMap: Record<string, string> = {
      logo: 'logo_url',
      icon: 'icon_url',
      logo_light: 'logo_light_url',
      icon_light: 'icon_light_url',
    };
    const updateField = fieldMap[type];
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({ [updateField]: null })
      .eq('id', params.id);

    if (updateError) {
      logger.error('[Branding] Error removing branding:', updateError);
      return internalError('Failed to remove branding', { error: updateError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/organization/[id]/branding:', error);
    return internalError('Failed to remove branding', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

