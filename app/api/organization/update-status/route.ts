import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/organization/update-status
 * Update organization subscription status
 * Can be called during signup (no auth required) or by webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organization_id, subscription_status } = body;

    if (!organization_id || !subscription_status) {
      return badRequest('Missing required fields: organization_id, subscription_status');
    }

    const validStatuses = ['trial', 'active', 'past_due', 'canceled', 'incomplete'];
    if (!validStatuses.includes(subscription_status)) {
      return badRequest(`Invalid subscription_status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const adminClient = createAdminSupabaseClient();

    // Get current organization status to prevent downgrades
    const { data: currentOrg, error: fetchError } = await adminClient
      .from('organizations')
      .select('subscription_status, updated_at')
      .eq('id', organization_id)
      .single();

    if (fetchError) {
      logger.error('Error fetching organization:', fetchError);
      return internalError('Failed to fetch organization', { error: fetchError.message });
    }

    if (!currentOrg) {
      return badRequest('Organization not found');
    }

    // Status priority: active > trial > past_due > canceled > incomplete
    const statusPriority: Record<string, number> = {
      'active': 5,
      'trial': 4,
      'past_due': 3,
      'canceled': 2,
      'incomplete': 1,
    };

    const currentPriority = statusPriority[currentOrg.subscription_status] || 0;
    const newPriority = statusPriority[subscription_status] || 0;

    // Only update if:
    // 1. Status is different AND
    // 2. New status has higher or equal priority (prevent downgrades from race conditions)
    // OR if explicitly moving to canceled (always allow)
    const shouldUpdate = 
      currentOrg.subscription_status !== subscription_status && 
      (newPriority >= currentPriority || subscription_status === 'canceled');

    if (!shouldUpdate) {
      logger.info('[Update Status] Skipping status update (would downgrade or no change):', {
        organizationId: organization_id,
        currentStatus: currentOrg.subscription_status,
        requestedStatus: subscription_status,
        currentPriority,
        newPriority,
      });
      return NextResponse.json({ 
        success: true, 
        skipped: true,
        reason: 'Status update skipped to prevent downgrade',
        currentStatus: currentOrg.subscription_status,
      });
    }

    // Update organization subscription status
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({
        subscription_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organization_id);

    if (updateError) {
      logger.error('Error updating organization status:', updateError);
      return internalError('Failed to update organization status', { error: updateError.message });
    }

    logger.info('[Update Status] Updated organization status:', {
      organizationId: organization_id,
      oldStatus: currentOrg.subscription_status,
      newStatus: subscription_status,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in POST /api/organization/update-status:', error);
    return internalError('Failed to update organization status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

