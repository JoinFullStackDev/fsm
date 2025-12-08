import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/affiliates/validate
 * Validate an affiliate code (public endpoint)
 * Returns basic info about the discount without revealing sensitive data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, package_id } = body;

    if (!code) {
      return badRequest('Affiliate code is required');
    }

    const adminClient = createAdminSupabaseClient();

    // Get affiliate code
    const { data: affiliate, error: affiliateError } = await adminClient
      .from('affiliate_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (affiliateError || !affiliate) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or inactive affiliate code',
      });
    }

    // Check validity dates
    const now = new Date();
    const validFrom = new Date(affiliate.valid_from);
    const validUntil = affiliate.valid_until ? new Date(affiliate.valid_until) : null;

    if (now < validFrom) {
      return NextResponse.json({
        valid: false,
        error: 'This affiliate code is not yet active',
      });
    }

    if (validUntil && now > validUntil) {
      return NextResponse.json({
        valid: false,
        error: 'This affiliate code has expired',
      });
    }

    // Check usage limits
    if (affiliate.max_uses !== null && affiliate.current_uses >= affiliate.max_uses) {
      return NextResponse.json({
        valid: false,
        error: 'This affiliate code has reached its maximum usage limit',
      });
    }

    // Check package restrictions
    if (package_id && affiliate.applicable_package_ids !== null) {
      if (!affiliate.applicable_package_ids.includes(package_id)) {
        return NextResponse.json({
          valid: false,
          error: 'This affiliate code is not valid for the selected package',
        });
      }
    }

    // Return success with safe info (don't expose commission data, etc.)
    return NextResponse.json({
      valid: true,
      code: {
        code: affiliate.code,
        name: affiliate.name,
        discount_type: affiliate.discount_type,
        discount_value: affiliate.discount_value,
        discount_duration_months: affiliate.discount_duration_months,
        bonus_trial_days: affiliate.bonus_trial_days,
      },
    });
  } catch (error) {
    logger.error('Error in POST /api/affiliates/validate:', error);
    return internalError('Failed to validate affiliate code', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

