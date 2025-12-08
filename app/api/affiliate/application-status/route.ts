import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliate/application-status
 * Get the current user's affiliate application status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', has_application: false },
        { status: 401 }
      );
    }

    const adminClient = createAdminSupabaseClient();

    // Get user's internal ID from users table
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({
        has_application: false,
        message: 'User profile not found',
      });
    }

    // Get user's affiliate application using internal user ID
    const { data: application, error: appError } = await adminClient
      .from('affiliate_applications')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (appError && appError.code !== 'PGRST116') {
      logger.error('[Affiliate Application Status] Error fetching application:', appError);
      return NextResponse.json(
        { error: 'Failed to fetch application status' },
        { status: 500 }
      );
    }

    if (!application) {
      return NextResponse.json({
        has_application: false,
        message: 'No affiliate application found',
      });
    }

    // Get reviewer info if reviewed
    let reviewer = null;
    if (application.reviewed_by) {
      const { data: reviewerData } = await adminClient
        .from('users')
        .select('name, email')
        .eq('id', application.reviewed_by)
        .single();
      
      if (reviewerData) {
        reviewer = { name: reviewerData.name };
      }
    }

    return NextResponse.json({
      has_application: true,
      application: {
        id: application.id,
        status: application.status,
        name: application.name,
        email: application.email,
        company_name: application.company_name,
        website: application.website,
        audience_size: application.audience_size,
        promotion_methods: application.promotion_methods,
        created_at: application.created_at,
        reviewed_at: application.reviewed_at,
        reviewer: reviewer,
        // Don't expose admin_notes to the user
      },
    });
  } catch (error) {
    logger.error('[Affiliate Application Status] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

