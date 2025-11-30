import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, badRequest, internalError, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId, validateOrganizationAccess } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/organization/[id]
 * Update organization (name only for now)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in');
    }

    const { id: organizationId } = params;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Organization name is required');
    }

    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, user.id, organizationId);
    if (!hasAccess) {
      return forbidden('You do not have access to this organization');
    }

    // Update organization
    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating organization:', updateError);
      return internalError('Failed to update organization', { error: updateError.message });
    }

    return NextResponse.json(updatedOrg);
  } catch (error) {
    logger.error('Error in PATCH /api/organization/[id]:', error);
    return internalError('Failed to update organization', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

