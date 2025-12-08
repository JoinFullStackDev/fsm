import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to apply.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      email,
      company_name,
      website,
      social_media_links,
      audience_size,
      audience_description,
      promotion_methods,
      motivation,
    } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!audience_size || !audience_size.trim()) {
      return NextResponse.json({ error: 'Audience size is required' }, { status: 400 });
    }
    if (!promotion_methods || promotion_methods.length === 0) {
      return NextResponse.json({ error: 'At least one promotion method is required' }, { status: 400 });
    }

    const adminSupabase = createAdminSupabaseClient();

    // Get the user's internal ID
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('id, is_affiliate')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      logger.error('[Affiliate Apply] User not found:', { authId: user.id, error: userError });
      return NextResponse.json(
        { error: 'User record not found. Please complete your profile first.' },
        { status: 404 }
      );
    }

    // Check if user is already an affiliate
    if (userData.is_affiliate) {
      return NextResponse.json(
        { error: 'You are already an affiliate. Visit your dashboard to manage your account.' },
        { status: 400 }
      );
    }

    // Check for existing pending application
    const { data: existingApp, error: existingError } = await adminSupabase
      .from('affiliate_applications')
      .select('id, status')
      .eq('user_id', userData.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingApp) {
      return NextResponse.json(
        { error: 'You already have a pending application. Please wait for it to be reviewed.' },
        { status: 400 }
      );
    }

    // Create the affiliate application
    const { data: application, error: insertError } = await adminSupabase
      .from('affiliate_applications')
      .insert({
        user_id: userData.id,
        name: name.trim(),
        email: email.trim(),
        company_name: company_name?.trim() || null,
        website: website?.trim() || null,
        social_media_links: social_media_links?.filter((l: string) => l?.trim()) || [],
        audience_size: audience_size.trim(),
        audience_description: audience_description?.trim() || null,
        promotion_methods: promotion_methods || [],
        motivation: motivation?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      logger.error('[Affiliate Apply] Failed to create application:', { error: insertError });
      return NextResponse.json(
        { error: 'Failed to submit application. Please try again.' },
        { status: 500 }
      );
    }

    logger.info('[Affiliate Apply] Application submitted:', {
      applicationId: application.id,
      userId: userData.id,
      email: email,
    });

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      application_id: application.id,
    });

  } catch (error) {
    logger.error('[Affiliate Apply] Unexpected error:', { error });
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

