import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { CreateAffiliateCodeInput } from '@/types/affiliate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/global/admin/affiliates
 * Get all affiliate codes with stats (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();

    // Get all affiliate codes
    const { data: affiliates, error: affiliatesError } = await adminClient
      .from('affiliate_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (affiliatesError) {
      logger.error('Error loading affiliates:', affiliatesError);
      return internalError('Failed to load affiliates', { error: affiliatesError.message });
    }

    // Get conversion counts for each affiliate
    const affiliateIds = (affiliates || []).map(a => a.id);
    
    let conversionCounts: Record<string, number> = {};
    if (affiliateIds.length > 0) {
      const { data: conversions, error: conversionsError } = await adminClient
        .from('affiliate_conversions')
        .select('affiliate_code_id')
        .in('affiliate_code_id', affiliateIds);

      if (!conversionsError && conversions) {
        conversionCounts = conversions.reduce((acc, conv) => {
          if (conv.affiliate_code_id) {
            acc[conv.affiliate_code_id] = (acc[conv.affiliate_code_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // Combine affiliates with stats
    const affiliatesWithStats = (affiliates || []).map(affiliate => ({
      ...affiliate,
      conversions_count: conversionCounts[affiliate.id] || 0,
    }));

    return NextResponse.json({ affiliates: affiliatesWithStats });
  } catch (error) {
    logger.error('Error in GET /api/global/admin/affiliates:', error);
    return internalError('Failed to load affiliates', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/global/admin/affiliates
 * Create a new affiliate code (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const adminClient = createAdminSupabaseClient();
    const body: CreateAffiliateCodeInput = await request.json();

    const {
      code,
      name,
      description,
      discount_type = 'percentage',
      discount_value = 0,
      discount_duration_months,
      bonus_trial_days = 0,
      affiliate_email,
      commission_percentage = 0,
      max_uses,
      valid_from,
      valid_until,
      applicable_package_ids,
    } = body;

    // Validate required fields
    if (!code || !name) {
      return badRequest('Code and name are required');
    }

    // Validate code format (alphanumeric and underscores/dashes only)
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      return badRequest('Code must contain only letters, numbers, underscores, and dashes');
    }

    // Validate discount type
    if (!['percentage', 'fixed_amount', 'trial_extension'].includes(discount_type)) {
      return badRequest('Invalid discount type');
    }

    // Validate discount value
    if (discount_type === 'percentage' && (discount_value < 0 || discount_value > 100)) {
      return badRequest('Percentage discount must be between 0 and 100');
    }

    if (discount_type === 'fixed_amount' && discount_value < 0) {
      return badRequest('Fixed amount discount must be positive');
    }

    // Validate commission percentage
    if (commission_percentage < 0 || commission_percentage > 100) {
      return badRequest('Commission percentage must be between 0 and 100');
    }

    // Check if code already exists
    const { data: existing } = await adminClient
      .from('affiliate_codes')
      .select('id')
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (existing) {
      return badRequest('An affiliate code with this code already exists');
    }

    // Create the affiliate code
    const { data: affiliate, error: createError } = await adminClient
      .from('affiliate_codes')
      .insert({
        code: code.toUpperCase(),
        name,
        description: description || null,
        discount_type,
        discount_value,
        discount_duration_months: discount_duration_months ?? null,
        bonus_trial_days,
        affiliate_email: affiliate_email || null,
        commission_percentage,
        max_uses: max_uses ?? null,
        valid_from: valid_from || new Date().toISOString(),
        valid_until: valid_until ?? null,
        applicable_package_ids: applicable_package_ids ?? null,
        is_active: true,
        current_uses: 0,
      })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating affiliate:', createError);
      if (createError.code === '23505') {
        return badRequest('An affiliate code with this code already exists');
      }
      return internalError('Failed to create affiliate', { error: createError.message });
    }

    logger.info('[Affiliates] Created affiliate code:', {
      id: affiliate.id,
      code: affiliate.code,
      name: affiliate.name,
    });

    return NextResponse.json({ affiliate });
  } catch (error) {
    logger.error('Error in POST /api/global/admin/affiliates:', error);
    return internalError('Failed to create affiliate', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

