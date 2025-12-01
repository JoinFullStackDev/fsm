import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getOrganizationContextById } from '@/lib/organizationContext';
import { getCachedContext, setCachedContext } from '@/lib/cache/organizationContextCache';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organization/context
 * Get current user's organization context
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      // Return empty context instead of error for unauthenticated users
      return NextResponse.json({
        organization: null,
        subscription: null,
        package: null,
      });
    }

    // Check cache first
    const cached = getCachedContext(user.id);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Use admin client to bypass RLS and avoid recursion
    // BUT still filter by the user's actual organization_id
    const { createAdminSupabaseClient } = await import('@/lib/supabaseAdmin');
    const adminClient = createAdminSupabaseClient();
    
    // Get user's organization_id directly with admin client (bypasses RLS)
    // This is safe because we're filtering by auth_id which is unique per user
    const { data: userRecord, error: userRecordError } = await adminClient
      .from('users')
      .select('id, organization_id, role, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (userRecordError || !userRecord) {
      // User record doesn't exist - return empty context
      logger.warn('[OrganizationContext API] User record not found:', { authId: user.id, error: userRecordError });
      return NextResponse.json({
        organization: null,
        subscription: null,
        package: null,
      });
    }

    if (!userRecord.organization_id) {
      // User has no organization - return empty context
      logger.warn('[OrganizationContext API] User has no organization_id:', { userId: userRecord.id });
      return NextResponse.json({
        organization: null,
        subscription: null,
        package: null,
      });
    }

    // Get organization context using admin client
    // This is safe because we're passing the user's actual organization_id
    logger.info('[OrganizationContext API] Fetching context for organization:', {
      userId: userRecord.id,
      organizationId: userRecord.organization_id,
    });
    
    const context = await getOrganizationContextById(adminClient, userRecord.organization_id);
    
    // Log what we got
    logger.info('[OrganizationContext API] Context fetched:', {
      hasOrganization: !!context?.organization,
      hasSubscription: !!context?.subscription,
      hasPackage: !!context?.package,
      subscriptionId: context?.subscription?.id,
      packageId: context?.package?.id,
      packageName: context?.package?.name,
    });
    
    // Verify the context belongs to the user's organization (security check)
    if (context && context.organization.id !== userRecord.organization_id) {
      logger.error('[OrganizationContext API] Security check failed: context org mismatch', {
        userId: userRecord.id,
        userOrgId: userRecord.organization_id,
        contextOrgId: context.organization.id,
      });
      return NextResponse.json({
        organization: null,
        subscription: null,
        package: null,
      });
    }

    if (!context) {
      logger.warn('[OrganizationContext API] No context returned for organization:', {
        userId: userRecord.id,
        organizationId: userRecord.organization_id,
      });
      return NextResponse.json({
        organization: null,
        subscription: null,
        package: null,
      });
    }
    
    if (!context.subscription) {
      logger.warn('[OrganizationContext API] No subscription found for organization:', {
        userId: userRecord.id,
        organizationId: userRecord.organization_id,
      });
    }
    
    if (!context.package) {
      logger.warn('[OrganizationContext API] No package found for organization:', {
        userId: userRecord.id,
        organizationId: userRecord.organization_id,
        subscriptionId: context.subscription?.id,
        packageId: context.subscription?.package_id,
      });
    }

    // Cache the result
    setCachedContext(user.id, context);

    return NextResponse.json(context);
  } catch (error) {
    logger.error('Error in GET /api/organization/context:', error);
    // Return empty context instead of error to prevent UI breakage
    return NextResponse.json({
      organization: null,
      subscription: null,
      package: null,
    });
  }
}

