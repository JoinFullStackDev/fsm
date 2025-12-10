import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const adminSupabase = createAdminSupabaseClient();

    // Get user's internal ID
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('id, is_affiliate')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!userData.is_affiliate) {
      return NextResponse.json(
        { error: 'You are not an affiliate. Please apply to become one.' },
        { status: 403 }
      );
    }

    // Get affiliate code for this user
    const { data: affiliateCode, error: codeError } = await adminSupabase
      .from('affiliate_codes')
      .select('*')
      .eq('affiliate_user_id', userData.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!affiliateCode) {
      return NextResponse.json({
        is_affiliate: true,
        has_code: false,
        message: 'Your affiliate account is pending code assignment. Please contact support.',
      });
    }

    // Get conversions for this affiliate
    const { data: conversions, error: convError } = await adminSupabase
      .from('affiliate_conversions')
      .select('*')
      .eq('affiliate_code_id', affiliateCode.id)
      .order('converted_at', { ascending: false });

    // Calculate stats
    const totalConversions = conversions?.length || 0;
    const totalCommission = conversions?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;
    const paidCommission = conversions?.filter(c => c.commission_paid).reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;
    const pendingCommission = totalCommission - paidCommission;

    // Get recent conversions (last 10)
    const recentConversions = conversions?.slice(0, 10).map(c => ({
      id: c.id,
      date: c.converted_at,
      discount_applied: c.discount_applied,
      commission: c.commission_amount,
      paid: c.commission_paid,
    })) || [];

    // Build referral link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fullstackmethod.com';
    const referralLink = `${baseUrl}/pricing?ref=${affiliateCode.code}`;

    return NextResponse.json({
      is_affiliate: true,
      has_code: true,
      affiliate_code: affiliateCode.code,
      referral_link: referralLink,
      discount: {
        type: affiliateCode.discount_type,
        value: affiliateCode.discount_value,
        duration_months: affiliateCode.discount_duration_months,
        bonus_trial_days: affiliateCode.bonus_trial_days,
      },
      commission_percentage: affiliateCode.commission_percentage,
      stats: {
        total_conversions: totalConversions,
        total_commission: totalCommission,
        paid_commission: paidCommission,
        pending_commission: pendingCommission,
        current_uses: affiliateCode.current_uses,
        max_uses: affiliateCode.max_uses,
      },
      recent_conversions: recentConversions,
    });

  } catch (error) {
    logger.error('[Affiliate Stats] Unexpected error:', { error });
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

