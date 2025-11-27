import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { testStripeConnection } from '@/lib/globalAdmin';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/global/admin/system/connections/stripe/test
 * Test Stripe connection (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const body = await request.json();
    const mode = body.mode || 'test';

    const result = await testStripeConnection(mode === 'live' ? 'live' : 'test');

    return NextResponse.json({
      success: result.success,
      message: result.message,
      error: result.error,
    });
  } catch (error) {
    logger.error('Error in POST /api/global/admin/system/connections/stripe/test:', error);
    return internalError('Failed to test Stripe connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

