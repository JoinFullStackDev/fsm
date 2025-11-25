import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { createActivityFeedItem } from '@/lib/ops/activityFeed';
import type { Opportunity } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view opportunities');
    }

    const { id } = params;

    // Get opportunity with company info
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .select(`
        *,
        company:companies(id, name)
      `)
      .eq('id', id)
      .single();

    if (opportunityError || !opportunity) {
      if (opportunityError?.code === 'PGRST116') {
        return notFound('Opportunity not found');
      }
      logger.error('Error loading opportunity:', opportunityError);
      return internalError('Failed to load opportunity', { error: opportunityError?.message });
    }

    return NextResponse.json(opportunity);
  } catch (error) {
    logger.error('Error in GET /api/ops/opportunities/[id]:', error);
    return internalError('Failed to load opportunity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to update opportunities');
    }

    const { id } = params;
    const body = await request.json();
    const { name, value, status, source } = body;

    // Get existing opportunity to check company_id and previous status
    const { data: existingOpportunity, error: existingError } = await supabase
      .from('opportunities')
      .select('company_id, status, name')
      .eq('id', id)
      .single();

    if (existingError || !existingOpportunity) {
      if (existingError?.code === 'PGRST116') {
        return notFound('Opportunity not found');
      }
      logger.error('Error checking opportunity:', existingError);
      return internalError('Failed to check opportunity', { error: existingError?.message });
    }

    // Validate
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return badRequest('Opportunity name cannot be empty');
    }

    // Build update object
    const updateData: Partial<Opportunity> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (value !== undefined) updateData.value = value ? parseFloat(value) : null;
    if (status !== undefined) updateData.status = status;
    if (source !== undefined) updateData.source = source;

    // Update opportunity
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (opportunityError || !opportunity) {
      logger.error('Error updating opportunity:', opportunityError);
      return internalError('Failed to update opportunity', { error: opportunityError?.message });
    }

    // Create activity feed item if status changed
    if (status !== undefined && status !== existingOpportunity.status) {
      try {
        await createActivityFeedItem(supabase, {
          company_id: existingOpportunity.company_id,
          related_entity_id: id,
          related_entity_type: 'opportunity',
          event_type: 'opportunity_status_changed',
          message: `Opportunity "${opportunity.name}" status changed from ${existingOpportunity.status} to ${status}`,
        });
      } catch (activityError) {
        logger.error('Error creating activity feed item:', activityError);
        // Don't fail the request if activity feed creation fails
      }
    }

    return NextResponse.json(opportunity);
  } catch (error) {
    logger.error('Error in PUT /api/ops/opportunities/[id]:', error);
    return internalError('Failed to update opportunity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to delete opportunities');
    }

    const { id } = params;

    // Check if opportunity exists
    const { data: opportunity, error: checkError } = await supabase
      .from('opportunities')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !opportunity) {
      if (checkError?.code === 'PGRST116') {
        return notFound('Opportunity not found');
      }
      logger.error('Error checking opportunity:', checkError);
      return internalError('Failed to check opportunity', { error: checkError?.message });
    }

    // Delete opportunity
    const { error: deleteError } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error('Error deleting opportunity:', deleteError);
      return internalError('Failed to delete opportunity', { error: deleteError.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/ops/opportunities/[id]:', error);
    return internalError('Failed to delete opportunity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

