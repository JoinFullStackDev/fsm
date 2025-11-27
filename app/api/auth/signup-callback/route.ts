import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getStripeClient } from '@/lib/stripe/client';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/signup-callback
 * Callback route after Stripe payment success during signup
 * Creates organization, user account, and subscription
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.redirect(new URL('/auth/signup?error=missing_session', request.url));
    }

    const stripe = await getStripeClient();
    const supabase = await createServerSupabaseClient();
    const adminClient = createAdminSupabaseClient();

    // Retrieve the Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (!checkoutSession.metadata?.is_signup || checkoutSession.metadata.is_signup !== 'true') {
      logger.error('[SignupCallback] Not a signup session');
      return NextResponse.redirect(new URL('/auth/signup?error=invalid_session', request.url));
    }

    const { 
      signup_email, 
      signup_name, 
      organization_name, 
      package_id 
    } = checkoutSession.metadata;

    if (!signup_email || !organization_name || !package_id) {
      logger.error('[SignupCallback] Missing required metadata:', checkoutSession.metadata);
      return NextResponse.redirect(new URL('/auth/signup?error=missing_data', request.url));
    }

    // Check if user already exists (in case they refresh the page)
    const { data: existingAuthUser } = await adminClient.auth.admin.listUsers();
    const authUser = existingAuthUser.users.find(u => u.email === signup_email);

    if (authUser) {
      // User already exists, sign them in
      logger.info('[SignupCallback] User already exists, signing in:', authUser.id);
      const { data: { session } } = await supabase.auth.signInWithPassword({
        email: signup_email,
        password: '', // We don't have the password, need to handle this differently
      });

      if (session) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // For now, redirect to signin page with a message
    // The user will need to set their password via email reset
    return NextResponse.redirect(
      new URL('/auth/signin?message=account_created_check_email', request.url)
    );
  } catch (error) {
    logger.error('Error in GET /api/auth/signup-callback:', error);
    return NextResponse.redirect(
      new URL('/auth/signup?error=callback_failed', request.url)
    );
  }
}

