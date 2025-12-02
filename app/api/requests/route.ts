import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, badRequest, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { FeatureBugRequestCreate } from '@/types/requests';

export const dynamic = 'force-dynamic';

/**
 * POST /api/requests
 * Create a new feature request or bug report
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to submit a request');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return unauthorized('User record not found');
    }

    const body: FeatureBugRequestCreate = await request.json();
    const { type, title, description, priority, page_url, steps_to_reproduce, expected_behavior, actual_behavior } = body;

    // Validate required fields
    if (!type || !title || !description) {
      return badRequest('Type, title, and description are required');
    }

    if (type !== 'feature' && type !== 'bug') {
      return badRequest('Type must be either "feature" or "bug"');
    }

    // Validate bug-specific fields
    if (type === 'bug') {
      if (!steps_to_reproduce || !expected_behavior || !actual_behavior) {
        return badRequest('Bug reports require steps_to_reproduce, expected_behavior, and actual_behavior');
      }
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (priority && !validPriorities.includes(priority)) {
      return badRequest(`Priority must be one of: ${validPriorities.join(', ')}`);
    }

    // Create request
    const requestData: any = {
      type,
      title: title.trim(),
      description: description.trim(),
      priority: priority || 'medium',
      user_id: userData.id,
      organization_id: userData.organization_id,
      page_url: type === 'bug' ? (page_url || null) : null,
      steps_to_reproduce: type === 'bug' ? steps_to_reproduce?.trim() || null : null,
      expected_behavior: type === 'bug' ? expected_behavior?.trim() || null : null,
      actual_behavior: type === 'bug' ? actual_behavior?.trim() || null : null,
      status: 'open',
    };

    const { data: newRequest, error: insertError } = await supabase
      .from('feature_bug_requests')
      .insert(requestData)
      .select()
      .single();

    if (insertError) {
      logger.error('[Requests API] Error creating request:', insertError);
      return internalError('Failed to create request', { error: insertError.message });
    }

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    logger.error('[Requests API] Error in POST /api/requests:', error);
    return internalError('Failed to create request', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

