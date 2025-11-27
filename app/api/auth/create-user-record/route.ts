import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/create-user-record
 * Creates a user record and assigns them to an organization
 * This is used during signin when a user record doesn't exist
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in');
    }

    const body = await request.json();
    const { email, name, role } = body;

    if (!email) {
      return badRequest('Email is required');
    }

    const adminClient = createAdminSupabaseClient();

    // Check if user record already exists
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', session.user.id)
      .single();

    if (existingUser) {
      // User exists - ensure they have an organization_id
      if (!existingUser.organization_id) {
        // Get or create FullStack organization
        let { data: orgData } = await adminClient
          .from('organizations')
          .select('id')
          .eq('slug', 'fullstack')
          .single();

        if (!orgData) {
          const { data: newOrg } = await adminClient
            .from('organizations')
            .insert({
              name: 'FullStack',
              slug: 'fullstack',
              subscription_status: 'active',
            })
            .select('id')
            .single();
          orgData = newOrg;
        }

        if (orgData) {
          await adminClient
            .from('users')
            .update({ organization_id: orgData.id })
            .eq('id', existingUser.id);
        }
      }

      // Fetch updated user record
      const { data: userRecord } = await adminClient
        .from('users')
        .select('id, role, invited_by_admin, last_active_at, organization_id')
        .eq('id', existingUser.id)
        .single();

      return NextResponse.json({ user: userRecord });
    }

    // User doesn't exist - create via RPC
    const { error: createError } = await supabase.rpc('create_user_record', {
      p_auth_id: session.user.id,
      p_email: email,
      p_name: name || '',
      p_role: role || 'pm',
    });

    if (createError) {
      logger.error('[CreateUserRecord] Error creating user record:', createError);
      return internalError('Failed to create user record', { error: createError.message });
    }

    // Get or create FullStack organization
    let { data: orgData } = await adminClient
      .from('organizations')
      .select('id')
      .eq('slug', 'fullstack')
      .single();

    if (!orgData) {
      const { data: newOrg } = await adminClient
        .from('organizations')
        .insert({
          name: 'FullStack',
          slug: 'fullstack',
          subscription_status: 'active',
        })
        .select('id')
        .single();
      orgData = newOrg;
    }

    // Assign user to organization using admin client
    if (orgData) {
      await adminClient
        .from('users')
        .update({ organization_id: orgData.id })
        .eq('auth_id', session.user.id);
    }

    // Fetch the newly created record using admin client (bypasses RLS)
    const { data: userRecord, error: fetchError } = await adminClient
      .from('users')
      .select('id, role, invited_by_admin, last_active_at, organization_id')
      .eq('auth_id', session.user.id)
      .single();

    if (fetchError || !userRecord) {
      logger.error('[CreateUserRecord] Error fetching created user record:', fetchError);
      return internalError('User record created but could not be retrieved', { error: fetchError?.message });
    }

    return NextResponse.json({ user: userRecord });
  } catch (error) {
    logger.error('[CreateUserRecord] Unexpected error:', error);
    return internalError('Failed to create user record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

