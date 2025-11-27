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
    // Use getUser() instead of getSession() for more reliable auth check
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      logger.warn('[CreateUserRecord] Auth error or no user:', authError);
      return unauthorized('You must be logged in');
    }

    const body = await request.json();
    const { email, name, role } = body;

    if (!email) {
      return badRequest('Email is required');
    }

    const adminClient = createAdminSupabaseClient();
    
    logger.info('[CreateUserRecord] Looking for user:', {
      authId: authUser.id,
      email: authUser.email || email,
    });

    // Check if user record already exists (with retry for timing issues)
    let existingUser = null;
    let existingUserError = null;
    
    // Try multiple times in case of timing issues
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await adminClient
        .from('users')
        .select('id, organization_id, role, invited_by_admin, last_active_at, auth_id, email')
        .eq('auth_id', authUser.id)
        .maybeSingle();
      
      existingUser = result.data;
      existingUserError = result.error;
      
      if (existingUser) {
        logger.info('[CreateUserRecord] Found existing user:', {
          userId: existingUser.id,
          authId: existingUser.auth_id,
          email: existingUser.email,
          hasOrgId: !!existingUser.organization_id,
          attempt: attempt + 1,
        });
        break; // Found user, exit loop
      }
      
      if (existingUserError && existingUserError.code !== 'PGRST116') {
        // Real error, not just "not found"
        logger.warn('[CreateUserRecord] Error checking for user (attempt ' + (attempt + 1) + '):', existingUserError);
        break;
      }
      
      // Wait a bit before retrying (user might be created by trigger)
      if (attempt < 2) {
        logger.debug('[CreateUserRecord] User not found, retrying in 500ms (attempt ' + (attempt + 1) + ')');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // If not found by auth_id, try by email as fallback
    if (!existingUser && !existingUserError) {
      logger.debug('[CreateUserRecord] User not found by auth_id, trying email:', email);
      const emailResult = await adminClient
        .from('users')
        .select('id, organization_id, role, invited_by_admin, last_active_at, auth_id, email')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      
      if (emailResult.data) {
        // Found by email - check if auth_id matches
        if (emailResult.data.auth_id === authUser.id) {
          existingUser = emailResult.data;
          logger.info('[CreateUserRecord] Found user by email with matching auth_id:', {
            userId: existingUser.id,
          });
        } else {
          logger.warn('[CreateUserRecord] User found by email but auth_id mismatch:', {
            foundAuthId: emailResult.data.auth_id,
            currentAuthId: authUser.id,
            email,
          });
        }
      }
    }

    if (existingUserError && existingUserError.code !== 'PGRST116') {
      logger.error('[CreateUserRecord] Error checking for existing user:', existingUserError);
      return internalError('Failed to check for existing user', { error: existingUserError.message });
    }

    if (existingUser) {
      // User exists - ensure they have an organization_id
      let updatedUser = existingUser;
      
      if (!existingUser.organization_id) {
        // Get or create FullStack organization (fallback for users without org)
        let { data: orgData } = await adminClient
          .from('organizations')
          .select('id')
          .eq('slug', 'fullstack')
          .maybeSingle();

        if (!orgData) {
          const { data: newOrg, error: orgError } = await adminClient
            .from('organizations')
            .insert({
              name: 'FullStack',
              slug: 'fullstack',
              subscription_status: 'active',
            })
            .select('id')
            .single();
          
          if (orgError) {
            logger.error('[CreateUserRecord] Error creating fallback organization:', orgError);
          } else {
            orgData = newOrg;
          }
        }

        if (orgData) {
          const { error: updateError } = await adminClient
            .from('users')
            .update({ organization_id: orgData.id })
            .eq('id', existingUser.id);

          if (updateError) {
            logger.error('[CreateUserRecord] Error updating user organization_id:', updateError);
          } else {
            // Fetch updated user record
            const { data: updatedUserData } = await adminClient
              .from('users')
              .select('id, role, invited_by_admin, last_active_at, organization_id, auth_id, email')
              .eq('id', existingUser.id)
              .single();
            
            if (updatedUserData) {
              updatedUser = updatedUserData;
            }
          }
        }
      }

      // Return the user record (with or without organization_id update)
      logger.info('[CreateUserRecord] Returning existing user:', {
        userId: updatedUser.id,
        hasOrgId: !!updatedUser.organization_id,
      });

      return NextResponse.json({ user: updatedUser });
    }

    // User doesn't exist - create directly using admin client (more reliable than RPC)
    // Get or create FullStack organization first
    let { data: orgData } = await adminClient
      .from('organizations')
      .select('id')
      .eq('slug', 'fullstack')
      .maybeSingle();

    if (!orgData) {
      const { data: newOrg, error: orgError } = await adminClient
        .from('organizations')
        .insert({
          name: 'FullStack',
          slug: 'fullstack',
          subscription_status: 'active',
        })
        .select('id')
        .single();
      
      if (orgError) {
        logger.error('[CreateUserRecord] Error creating fallback organization:', orgError);
        // Continue without org - user can be assigned later
      } else {
        orgData = newOrg;
      }
    }

    // Create user record directly with admin client
    const insertData = {
      auth_id: authUser.id,
      email: email.trim().toLowerCase(),
      name: name?.trim() || null,
      role: role || 'pm',
      organization_id: orgData?.id || null,
    };

    logger.info('[CreateUserRecord] Creating user record:', {
      authId: authUser.id,
      email: insertData.email,
      hasOrgId: !!orgData?.id,
    });

    const { data: newUser, error: createError } = await adminClient
      .from('users')
      .insert(insertData)
      .select('id, role, invited_by_admin, last_active_at, organization_id')
      .single();

    if (createError) {
      // If it's a unique constraint violation, user was created between check and insert
      if (createError.code === '23505') {
        logger.info('[CreateUserRecord] Unique constraint violation - user exists, fetching existing');
        logger.info('[CreateUserRecord] Constraint violation details:', {
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
        });
        
        // The unique constraint could be on email or auth_id
        // Try multiple ways to find the user
        let existingUserData = null;
        
        // Method 1: Try by auth_id
        const authIdResult = await adminClient
          .from('users')
          .select('id, role, invited_by_admin, last_active_at, organization_id, auth_id, email')
          .eq('auth_id', authUser.id)
          .maybeSingle();
        
        logger.info('[CreateUserRecord] Auth ID query result:', {
          hasData: !!authIdResult.data,
          hasError: !!authIdResult.error,
          error: authIdResult.error,
          authId: authUser.id,
        });
        
        if (authIdResult.data) {
          existingUserData = authIdResult.data;
          logger.info('[CreateUserRecord] Found user by auth_id after conflict');
        } else if (authIdResult.error && authIdResult.error.code !== 'PGRST116') {
          // Real error (not just "not found")
          logger.error('[CreateUserRecord] Error querying by auth_id:', authIdResult.error);
        } else {
          // Method 2: Try by email (exact match first)
          logger.info('[CreateUserRecord] Not found by auth_id, trying email (exact):', email);
          const emailResult = await adminClient
            .from('users')
            .select('id, role, invited_by_admin, last_active_at, organization_id, auth_id, email')
            .eq('email', email.trim().toLowerCase())
            .maybeSingle();
          
          // Method 2b: If exact match fails, try case-insensitive
          if (!emailResult.data && !emailResult.error) {
            logger.info('[CreateUserRecord] Not found by exact email, trying case-insensitive');
            const emailIlikeResult = await adminClient
              .from('users')
              .select('id, role, invited_by_admin, last_active_at, organization_id, auth_id, email')
              .ilike('email', email.trim().toLowerCase())
              .maybeSingle();
            
            if (emailIlikeResult.data) {
              logger.info('[CreateUserRecord] Found user with case-insensitive email match');
              existingUserData = emailIlikeResult.data;
            }
          }
          
          logger.info('[CreateUserRecord] Email query result:', {
            hasData: !!emailResult.data,
            hasError: !!emailResult.error,
            error: emailResult.error,
            email: email.trim().toLowerCase(),
          });
          
          if (emailResult.data) {
            existingUserData = emailResult.data;
            logger.info('[CreateUserRecord] Found user by email after conflict');
            
            // If auth_id doesn't match, update it
            if (existingUserData.auth_id !== authUser.id) {
              logger.warn('[CreateUserRecord] Auth ID mismatch, updating:', {
                oldAuthId: existingUserData.auth_id,
                newAuthId: authUser.id,
              });
              
              const updateResult = await adminClient
                .from('users')
                .update({ auth_id: authUser.id })
                .eq('id', existingUserData.id);
              
              if (updateResult.error) {
                logger.error('[CreateUserRecord] Error updating auth_id:', updateResult.error);
              }
            }
          } else if (!emailResult.error || emailResult.error.code === 'PGRST116') {
            // Not found by exact match, try case-insensitive
            logger.info('[CreateUserRecord] Not found by exact email, trying case-insensitive');
            const emailIlikeResult = await adminClient
              .from('users')
              .select('id, role, invited_by_admin, last_active_at, organization_id, auth_id, email')
              .ilike('email', email.trim().toLowerCase())
              .maybeSingle();
            
            logger.info('[CreateUserRecord] Case-insensitive email query result:', {
              hasData: !!emailIlikeResult.data,
              hasError: !!emailIlikeResult.error,
              error: emailIlikeResult.error,
            });
            
            if (emailIlikeResult.data) {
              existingUserData = emailIlikeResult.data;
              logger.info('[CreateUserRecord] Found user with case-insensitive email match');
              
              // If auth_id doesn't match, update it
              if (existingUserData.auth_id !== authUser.id) {
                logger.warn('[CreateUserRecord] Auth ID mismatch on case-insensitive match, updating');
                await adminClient
                  .from('users')
                  .update({ auth_id: authUser.id })
                  .eq('id', existingUserData.id);
              }
            }
          }
        }

        if (!existingUserData) {
          // Last resort: try to find ANY user with this email or auth_id
          logger.error('[CreateUserRecord] Could not find user by auth_id or email after conflict');
          logger.error('[CreateUserRecord] Create error details:', {
            code: createError.code,
            message: createError.message,
            details: createError.details,
            hint: createError.hint,
          });
          
          // Try a broader search - use ilike for email in case of case differences
          // First try by auth_id
          const authIdSearch = await adminClient
            .from('users')
            .select('id, auth_id, email, organization_id, role, invited_by_admin, last_active_at')
            .eq('auth_id', authUser.id);
          
          // Then try by email (case-insensitive)
          const emailSearch = await adminClient
            .from('users')
            .select('id, auth_id, email, organization_id, role, invited_by_admin, last_active_at')
            .ilike('email', email.trim().toLowerCase());
          
          const allUsers = authIdSearch.data || emailSearch.data || [];
          const searchError = authIdSearch.error || emailSearch.error;
          
          logger.error('[CreateUserRecord] Broader search results:', {
            found: allUsers?.length || 0,
            users: allUsers,
            searchError,
          });
          
          if (allUsers && allUsers.length > 0) {
            // Found at least one user - use the first one
            const foundUser = allUsers[0];
            logger.info('[CreateUserRecord] Using user from broader search:', {
              userId: foundUser.id,
              authId: foundUser.auth_id,
              email: foundUser.email,
            });
            
            // Update auth_id if it doesn't match
            if (foundUser.auth_id !== authUser.id) {
              logger.warn('[CreateUserRecord] Updating auth_id on found user');
              await adminClient
                .from('users')
                .update({ auth_id: authUser.id })
                .eq('id', foundUser.id);
            }
            
            // Update organization_id if needed
            if (!foundUser.organization_id && orgData) {
              await adminClient
                .from('users')
                .update({ organization_id: orgData.id })
                .eq('id', foundUser.id);
              
              // Fetch updated
              const { data: updated } = await adminClient
                .from('users')
                .select('id, role, invited_by_admin, last_active_at, organization_id')
                .eq('id', foundUser.id)
                .maybeSingle();
              
              if (updated) {
                return NextResponse.json({ user: updated });
              }
            }
            
            return NextResponse.json({ 
              user: {
                id: foundUser.id,
                role: foundUser.role || role || 'pm',
                invited_by_admin: foundUser.invited_by_admin || false,
                last_active_at: foundUser.last_active_at,
                organization_id: foundUser.organization_id,
              }
            });
          }
          
          // User definitely exists (we got a conflict), but we can't find it
          // This is a rare edge case - return a minimal user object so signin can proceed
          // The user can be fixed later, but at least they can sign in
          logger.error('[CreateUserRecord] CRITICAL: User exists but cannot be retrieved. Creating minimal response.');
          
          // Try one more time with separate queries
          logger.error('[CreateUserRecord] Attempting final search with separate queries');
          
          // Query 1: Exact auth_id match
          const finalAuthIdQuery = await adminClient
            .from('users')
            .select('*')
            .eq('auth_id', authUser.id)
            .maybeSingle();
          
          // Query 2: Email match (case-insensitive)
          const finalEmailQuery = await adminClient
            .from('users')
            .select('*')
            .ilike('email', `%${email.trim().toLowerCase()}%`)
            .limit(5);
          
          const matchingUser = finalAuthIdQuery.data || finalEmailQuery.data?.[0];
          
          if (matchingUser) {
            logger.info('[CreateUserRecord] Found user in final search, returning it');
            return NextResponse.json({ 
              user: {
                id: matchingUser.id,
                role: matchingUser.role || role || 'pm',
                invited_by_admin: matchingUser.invited_by_admin || false,
                last_active_at: matchingUser.last_active_at,
                organization_id: matchingUser.organization_id || orgData?.id || null,
              }
            });
          }
          
          // If we still can't find it, the user definitely exists (we got a conflict)
          // but something is very wrong. Log everything and return an error
          logger.error('[CreateUserRecord] CRITICAL: User exists (conflict) but cannot be found by any method');
          logger.error('[CreateUserRecord] Search parameters:', {
            authId: authUser.id,
            email: email,
            emailLower: email.trim().toLowerCase(),
          });
          logger.error('[CreateUserRecord] Final query results:', {
            authIdQuery: finalAuthIdQuery,
            emailQuery: finalEmailQuery,
          });
          
          return internalError('User record exists but could not be retrieved. Please contact support with your email address.', { 
            error: 'User not found after creation conflict despite multiple search attempts',
            authId: authUser.id,
            email: email,
            suggestion: 'The user record exists in the database but cannot be located. This may require manual database inspection.',
          });
        }

        // Update organization_id if needed
        if (!existingUserData.organization_id && orgData) {
          const { error: updateError } = await adminClient
            .from('users')
            .update({ organization_id: orgData.id })
            .eq('id', existingUserData.id);
          
          if (updateError) {
            logger.warn('[CreateUserRecord] Error updating organization_id:', updateError);
          } else {
            // Fetch updated record
            const { data: updatedUser } = await adminClient
              .from('users')
              .select('id, role, invited_by_admin, last_active_at, organization_id')
              .eq('id', existingUserData.id)
              .maybeSingle();
            
            if (updatedUser) {
              return NextResponse.json({ user: updatedUser });
            }
          }
        }

        return NextResponse.json({ user: existingUserData });
      }

      logger.error('[CreateUserRecord] Error creating user record:', createError);
      return internalError('Failed to create user record', { error: createError.message });
    }

    if (!newUser) {
      // User was created but not returned - try to fetch it
      logger.warn('[CreateUserRecord] User created but not returned, attempting to fetch');
      
      // Wait a moment for the database to commit
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try multiple ways to fetch the user
      let fetchedUser = null;
      
      // Method 1: By auth_id
      const authIdFetch = await adminClient
        .from('users')
        .select('id, role, invited_by_admin, last_active_at, organization_id, auth_id, email')
        .eq('auth_id', authUser.id)
        .maybeSingle();
      
      if (authIdFetch.data) {
        fetchedUser = authIdFetch.data;
        logger.info('[CreateUserRecord] Found user by auth_id after creation');
      } else {
        // Method 2: By email
        logger.info('[CreateUserRecord] Not found by auth_id, trying email:', email);
        const emailFetch = await adminClient
          .from('users')
          .select('id, role, invited_by_admin, last_active_at, organization_id, auth_id, email')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle();
        
        if (emailFetch.data) {
          fetchedUser = emailFetch.data;
          logger.info('[CreateUserRecord] Found user by email after creation');
          
          // If auth_id doesn't match, update it
          if (fetchedUser.auth_id !== authUser.id) {
            logger.warn('[CreateUserRecord] Auth ID mismatch, updating:', {
              oldAuthId: fetchedUser.auth_id,
              newAuthId: authUser.id,
            });
            
            await adminClient
              .from('users')
              .update({ auth_id: authUser.id })
              .eq('id', fetchedUser.id);
          }
        }
      }

      if (!fetchedUser) {
        logger.error('[CreateUserRecord] Error fetching created user record - tried both auth_id and email');
        logger.error('[CreateUserRecord] Insert data was:', insertData);
        logger.error('[CreateUserRecord] Auth user:', {
          id: authUser.id,
          email: authUser.email,
        });
        
        // Last resort: try to find ANY user with broader search
        // Try by auth_id first
        const authIdSearch = await adminClient
          .from('users')
          .select('id, auth_id, email, organization_id, role, invited_by_admin, last_active_at')
          .eq('auth_id', authUser.id);
        
        // Then try by email (case-insensitive)
        const emailSearch = await adminClient
          .from('users')
          .select('id, auth_id, email, organization_id, role, invited_by_admin, last_active_at')
          .ilike('email', email.trim().toLowerCase());
        
        const anyUsers = authIdSearch.data || emailSearch.data || [];
        const anyUsersError = authIdSearch.error || emailSearch.error;
        
        logger.error('[CreateUserRecord] Broader search found:', {
          count: anyUsers?.length || 0,
          users: anyUsers,
          error: anyUsersError,
        });
        
        if (anyUsers && anyUsers.length > 0) {
          // Found user(s) - use the first one
          const foundUser = anyUsers[0];
          logger.info('[CreateUserRecord] Using user from broader search after creation:', {
            userId: foundUser.id,
            authId: foundUser.auth_id,
            email: foundUser.email,
          });
          
          // Update auth_id if it doesn't match
          if (foundUser.auth_id !== authUser.id) {
            await adminClient
              .from('users')
              .update({ auth_id: authUser.id })
              .eq('id', foundUser.id);
          }
          
          // Update organization_id if needed
          if (!foundUser.organization_id && orgData) {
            await adminClient
              .from('users')
              .update({ organization_id: orgData.id })
              .eq('id', foundUser.id);
            
            // Fetch updated
            const { data: updated } = await adminClient
              .from('users')
              .select('id, role, invited_by_admin, last_active_at, organization_id')
              .eq('id', foundUser.id)
              .maybeSingle();
            
            if (updated) {
              return NextResponse.json({ user: updated });
            }
          }
          
          return NextResponse.json({ 
            user: {
              id: foundUser.id,
              role: foundUser.role || role || 'pm',
              invited_by_admin: foundUser.invited_by_admin || false,
              last_active_at: foundUser.last_active_at,
              organization_id: foundUser.organization_id,
            }
          });
        }
        
        return internalError('User record created but could not be retrieved. Please contact support.', { 
          error: 'User not found after creation',
          authId: authUser.id,
          email: email,
        });
      }

      return NextResponse.json({ user: fetchedUser });
    }

    logger.info('[CreateUserRecord] User record created successfully:', {
      userId: newUser.id,
      hasOrgId: !!newUser.organization_id,
    });

    return NextResponse.json({ user: newUser });
  } catch (error) {
    logger.error('[CreateUserRecord] Unexpected error:', error);
    return internalError('Failed to create user record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

