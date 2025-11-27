import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/create-organization
 * Create an organization during signup (public endpoint, uses admin client to bypass RLS)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Organization name is required');
    }

    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return badRequest('Organization slug is required');
    }

    // Validate slug format (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return badRequest('Invalid organization slug format');
    }

    const adminClient = createAdminSupabaseClient();

    // Check if slug already exists
    const { data: existingOrg, error: checkError } = await adminClient
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      logger.error('Error checking existing organization:', checkError);
      return internalError('Failed to validate organization', { error: checkError.message });
    }

    // IDEMPOTENCY: If organization already exists, return it instead of erroring
    if (existingOrg) {
      logger.info('[Create Organization] Organization already exists, returning existing:', {
        organizationId: existingOrg.id,
        slug,
      });
      
      // Fetch full organization data
      const { data: orgData, error: fetchError } = await adminClient
        .from('organizations')
        .select('*')
        .eq('id', existingOrg.id)
        .single();

      if (fetchError) {
        logger.error('[Create Organization] Error fetching existing organization:', fetchError);
        return internalError('Failed to fetch existing organization', { error: fetchError.message });
      }

      return NextResponse.json({ organization: orgData });
    }

    // Create organization using admin client (bypasses RLS)
    // Note: organizations.subscription_status uses 'trial' (not 'trialing')
    // subscriptions.status uses 'trialing' (not 'trial')
    const { data: orgData, error: orgError } = await adminClient
      .from('organizations')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        subscription_status: 'trial', // organizations table enum uses 'trial'
      })
      .select()
      .single();

    if (orgError) {
      logger.error('Error creating organization:', orgError);
      
      // Handle unique constraint violation - organization was created between check and insert
      if (orgError.code === '23505') {
        logger.info('[Create Organization] Race condition: organization created between check and insert, fetching existing');
        
        // Fetch the existing organization
        const { data: existingOrgData, error: fetchError } = await adminClient
          .from('organizations')
          .select('*')
          .eq('slug', slug.trim())
          .single();

        if (fetchError || !existingOrgData) {
          return badRequest('An organization with this name already exists. Please choose a different name.');
        }

        return NextResponse.json({ organization: existingOrgData });
      }
      
      return internalError('Failed to create organization', { error: orgError.message });
    }

    return NextResponse.json({ organization: orgData });
  } catch (error) {
    logger.error('Error in POST /api/auth/create-organization:', error);
    return internalError('Failed to create organization', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

