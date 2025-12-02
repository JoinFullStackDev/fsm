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
      .select('id, name')
      .eq('id', organization_id)
      .single();

    if (orgCheckError || !orgCheck) {
      logger.error('[CreateUserWithOrg] Organization not found:', { 
        organization_id, 
        error: orgCheckError?.message,
        errorCode: orgCheckError?.code,
      });
      return badRequest('Invalid organization. Please try signing up again.');
    }

    logger.info('[CreateUserWithOrg] Verifying organization assignment:', {
      organizationId: organization_id,
      organizationName: orgCheck.name,
      userEmail: email,
      authUserId: session.user.id,
    });

    // Check if user record already exists
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, organization_id, name')
      .eq('auth_id', session.user.id)
      .maybeSingle();

    if (existingUser) {
      // User exists (likely created by trigger) - update organization_id and name if needed
      // Check if user already has wrong organization assigned (shouldn't happen with fixed trigger, but handle it)
      if (existingUser.organization_id && existingUser.organization_id !== organization_id) {
        logger.warn('[CreateUserWithOrg] User already has different organization_id assigned:', {
          userId: existingUser.id,
          currentOrgId: existingUser.organization_id,
          expectedOrgId: organization_id,
          email,
        });
      }
      
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

      // Retry logic for update (handles race conditions)
      const maxRetries = 3;
      let userRecord = null;
      let lastError = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Exponential backoff: 500ms, 1000ms
            const delay = 500 * Math.pow(2, attempt - 1);
            logger.info('[CreateUserWithOrg] Retrying user update (attempt ' + (attempt + 1) + '):', {
              delay,
              userId: existingUser.id,
              organizationId: organization_id,
            });
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const { error: updateError } = await adminClient
            .from('users')
            .update(updates)
            .eq('id', existingUser.id);

          if (updateError) {
            lastError = updateError;
            logger.warn('[CreateUserWithOrg] Update attempt ' + (attempt + 1) + ' failed:', {
              error: updateError.message,
              errorCode: updateError.code,
              userId: existingUser.id,
              attempt: attempt + 1,
            });
            
            if (attempt === maxRetries - 1) {
              logger.error('Error updating user after all retries:', updateError);
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
            continue; // Retry
          }

          // Fetch updated user record
          const { data: fetchedUser } = await adminClient
            .from('users')
            .select('id, name, email, role, organization_id')
            .eq('id', existingUser.id)
            .single();

          if (!fetchedUser) {
            lastError = 'User record not found after update';
            logger.warn('[CreateUserWithOrg] User record not found after update (attempt ' + (attempt + 1) + ')');
            
            if (attempt === maxRetries - 1) {
              return internalError('User record not found after update', {
                userId: existingUser.id,
              });
            }
            continue; // Retry
          }

          // Verify organization assignment
          if (fetchedUser.organization_id !== organization_id) {
            lastError = 'Organization assignment mismatch';
            logger.warn('[CreateUserWithOrg] Organization assignment mismatch after update (attempt ' + (attempt + 1) + '):', {
              userId: fetchedUser.id,
              expectedOrgId: organization_id,
              actualOrgId: fetchedUser.organization_id,
            });
            
            if (attempt === maxRetries - 1) {
              logger.error('[CreateUserWithOrg] Organization assignment mismatch after all retries:', {
                userId: fetchedUser.id,
                expectedOrgId: organization_id,
                actualOrgId: fetchedUser.organization_id,
              });
              return internalError('Failed to assign user to organization', {
                expectedOrgId: organization_id,
                actualOrgId: fetchedUser.organization_id,
              });
            }
            
            // Wait a bit longer before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue; // Retry
          }

          userRecord = fetchedUser;
          break; // Success
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Unknown error';
          logger.error('[CreateUserWithOrg] Error in update attempt ' + (attempt + 1) + ':', {
            error: lastError,
            userId: existingUser.id,
            organizationId: organization_id,
          });
          
          if (attempt === maxRetries - 1) {
            return internalError('Failed to update user after retries', {
              error: lastError,
              userId: existingUser.id,
            });
          }
        }
      }

      if (!userRecord || userRecord.organization_id !== organization_id) {
        logger.error('[CreateUserWithOrg] Failed to update user after all retries:', {
          hasUser: !!userRecord,
          expectedOrgId: organization_id,
          actualOrgId: userRecord?.organization_id,
          userId: existingUser.id,
        });
        return internalError('Failed to assign user to organization after retries', {
          expectedOrgId: organization_id,
          actualOrgId: userRecord?.organization_id,
        });
      }

      logger.info('[CreateUserWithOrg] User updated and verified:', {
        userId: userRecord.id,
        email: userRecord.email,
        organizationId: userRecord.organization_id,
      });

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
      logger.error('[CreateUserWithOrg] Error creating user:', createError);
      logger.error('[CreateUserWithOrg] User creation details:', insertData);
      logger.error('[CreateUserWithOrg] Error details:', {
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

    // Verify organization assignment after creation
    if (newUser && newUser.organization_id !== organization_id) {
      logger.error('[CreateUserWithOrg] Organization assignment mismatch after creation:', {
        userId: newUser.id,
        expectedOrgId: organization_id,
        actualOrgId: newUser.organization_id,
      });
      return internalError('User was assigned to incorrect organization', {
        expectedOrgId: organization_id,
        actualOrgId: newUser.organization_id,
      });
    }

    logger.info('[CreateUserWithOrg] User successfully created and verified:', {
      userId: newUser?.id,
      email: newUser?.email,
      organizationId: newUser?.organization_id,
      role: newUser?.role,
    });

    return NextResponse.json({ user: newUser });
  } catch (error) {
    logger.error('Error in POST /api/auth/create-user-with-org:', error);
    return internalError('Failed to create user', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

