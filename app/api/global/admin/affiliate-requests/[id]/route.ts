import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import logger from '@/lib/utils/logger';

// Generate a unique affiliate code
function generateAffiliateCode(name: string): string {
  const cleanName = name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${cleanName}${randomSuffix}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(request);

    const { id } = await params;
    const adminSupabase = createAdminSupabaseClient();

    const { data: application, error } = await adminSupabase
      .from('affiliate_applications')
      .select(`
        *,
        user:users!affiliate_applications_user_id_fkey(id, name, email),
        reviewer:users!affiliate_applications_reviewed_by_fkey(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (error || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ application });

  } catch (error) {
    if (error instanceof Error && error.message.includes('Super admin access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logger.error('[Admin Affiliate Request GET] Unexpected error:', { error });
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireSuperAdmin(request);

    const { id } = await params;
    const body = await request.json();
    const { action, admin_notes, commission_percentage = 10 } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject".' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminSupabaseClient();

    // Get the application
    const { data: application, error: fetchError } = await adminSupabase
      .from('affiliate_applications')
      .select('*, user:users!affiliate_applications_user_id_fkey(id, name, email)')
      .eq('id', id)
      .single();

    if (fetchError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    if (application.status !== 'pending') {
      return NextResponse.json(
        { error: `Application already ${application.status}` },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update the application
    // Note: adminUser.userId from requireSuperAdmin is already the internal users.id
    const { error: updateError } = await adminSupabase
      .from('affiliate_applications')
      .update({
        status: newStatus,
        reviewed_by: adminUser.userId,
        reviewed_at: new Date().toISOString(),
        admin_notes: admin_notes || null,
      })
      .eq('id', id);

    if (updateError) {
      logger.error('[Admin Affiliate Request] Failed to update application:', { error: updateError });
      return NextResponse.json(
        { error: 'Failed to update application' },
        { status: 500 }
      );
    }

    // If approved, create affiliate code and mark user as affiliate
    if (action === 'approve') {
      // Generate a unique code
      let affiliateCode = generateAffiliateCode(application.name);
      let codeExists = true;
      let attempts = 0;

      while (codeExists && attempts < 10) {
        const { data: existingCode } = await adminSupabase
          .from('affiliate_codes')
          .select('id')
          .eq('code', affiliateCode)
          .maybeSingle();
        
        if (!existingCode) {
          codeExists = false;
        } else {
          affiliateCode = generateAffiliateCode(application.name);
          attempts++;
        }
      }

      // Create the affiliate code
      const { data: newCode, error: codeError } = await adminSupabase
        .from('affiliate_codes')
        .insert({
          code: affiliateCode,
          name: `${application.name}'s Affiliate Link`,
          description: `Affiliate code for ${application.name}`,
          discount_type: 'percentage',
          discount_value: 10, // Default 10% discount for referrals
          discount_duration_months: 3, // First 3 months
          bonus_trial_days: 7, // 7 extra trial days
          affiliate_user_id: application.user_id,
          affiliate_email: application.email,
          commission_percentage: commission_percentage,
          is_active: true,
        })
        .select()
        .single();

      if (codeError) {
        logger.error('[Admin Affiliate Request] Failed to create affiliate code:', { error: codeError });
        // Don't fail the approval, but log the error
      }

      // Mark user as affiliate
      const { error: userUpdateError } = await adminSupabase
        .from('users')
        .update({ is_affiliate: true })
        .eq('id', application.user_id);

      if (userUpdateError) {
        logger.error('[Admin Affiliate Request] Failed to mark user as affiliate:', { error: userUpdateError });
      }

      logger.info('[Admin Affiliate Request] Application approved:', {
        applicationId: id,
        userId: application.user_id,
        affiliateCode: affiliateCode,
      });

      return NextResponse.json({
        success: true,
        message: 'Application approved',
        affiliate_code: newCode?.code,
      });
    }

    logger.info('[Admin Affiliate Request] Application rejected:', {
      applicationId: id,
      userId: application.user_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Application rejected',
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('Super admin access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logger.error('[Admin Affiliate Request PUT] Unexpected error:', { error });
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

