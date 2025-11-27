import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/create-user-with-org
 * Create user record and assign to organization during signup
 * This uses admin client to bypass RLS and ensure name is saved
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in');
    }

    const body = await request.json();
    const { email, name, role, organization_id } = body;

    if (!email) {
      return badRequest('Email is required');
    }

    if (!organization_id) {
      return badRequest('Organization ID is required');
    }

    const adminClient = createAdminSupabaseClient();

    // Verify organization exists
    const { data: orgCheck, error: orgCheckError } = await adminClient
      .from('organizations')
      .select('id')
      .eq('id', organization_id)
      .single();

    if (orgCheckError || !orgCheck) {
      logger.error('Organization not found:', { organization_id, error: orgCheckError });
      return badRequest('Invalid organization. Please try signing up again.');
    }

    // Check if user record already exists
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, organization_id, name')
      .eq('auth_id', session.user.id)
      .maybeSingle();

    if (existingUser) {
      // User exists (likely created by trigger) - update organization_id and name if needed
      logger.info('User already exists, updating:', { 
        userId: existingUser.id, 
        currentOrgId: existingUser.organization_id,
        newOrgId: organization_id 
      });
      
      const updates: { organization_id: string; name?: string } = {
        organization_id,
      };

      if (name && name.trim() && existingUser.name !== name.trim()) {
        updates.name = name.trim();
      }

      const { error: updateError } = await adminClient
        .from('users')
        .update(updates)
        .eq('id', existingUser.id);

      if (updateError) {
        logger.error('Error updating user:', updateError);
        logger.error('Update details:', {
          userId: existingUser.id,
          updates,
          errorCode: updateError.code,
          errorMessage: updateError.message,
          errorDetails: updateError.details,
          errorHint: updateError.hint,
        });
        
        let errorMessage = 'Failed to update user';
        if (updateError.code === '23503') {
          errorMessage = 'Invalid organization. Please try signing up again.';
        } else if (updateError.hint) {
          errorMessage = updateError.hint;
        } else if (updateError.message) {
          errorMessage = updateError.message;
        }
        
        return internalError(errorMessage, { 
          error: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });
      }

      // Fetch updated user record
      const { data: userRecord } = await adminClient
        .from('users')
        .select('id, name, email, role, organization_id')
        .eq('id', existingUser.id)
        .single();

      return NextResponse.json({ user: userRecord });
    }

    // Check if email already exists (unique constraint)
    const { data: existingEmail } = await adminClient
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      logger.error('Email already exists:', email);
      return badRequest('An account with this email already exists. Please sign in instead.');
    }

    // Verify auth user exists
    if (!session.user || !session.user.id) {
      logger.error('Invalid session user');
      return unauthorized('Invalid session. Please try signing up again.');
    }

    // User doesn't exist - create with admin client to ensure name is saved
    const insertData = {
      auth_id: session.user.id,
      email: email.trim().toLowerCase(),
      name: name?.trim() || null, // Use null instead of empty string
      role: role || 'admin',
      organization_id,
    };
    
    logger.info('Creating user with data:', insertData);
    logger.info('Session user:', { id: session.user.id, email: session.user.email });
    
    const { data: newUser, error: createError } = await adminClient
      .from('users')
      .insert(insertData)
      .select('id, name, email, role, organization_id')
      .single();

    if (createError) {
      logger.error('Error creating user:', createError);
      logger.error('User creation details:', insertData);
      logger.error('Error details:', {
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code,
      });
      
      // Provide more specific error messages
      let errorMessage = 'Database error saving new user';
      if (createError.code === '23505') {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (createError.code === '23503') {
        errorMessage = 'Invalid organization. Please try signing up again.';
      } else if (createError.hint) {
        errorMessage = createError.hint;
      } else if (createError.message) {
        errorMessage = createError.message;
      }
      
      return internalError(errorMessage, { 
        error: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code,
      });
    }

    return NextResponse.json({ user: newUser });
  } catch (error) {
    logger.error('Error in POST /api/auth/create-user-with-org:', error);
    return internalError('Failed to create user', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

