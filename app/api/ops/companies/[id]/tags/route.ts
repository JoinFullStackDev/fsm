import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { createActivityFeedItem } from '@/lib/ops/activityFeed';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view company tags');
    }

    const { id: companyId } = params;

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      if (companyError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error checking company:', companyError);
      return internalError('Failed to check company', { error: companyError?.message });
    }

    // Get tags
    const { data: tags, error: tagsError } = await supabase
      .from('company_tags')
      .select('*')
      .eq('company_id', companyId)
      .order('tag_name', { ascending: true });

    if (tagsError) {
      logger.error('Error loading tags:', tagsError);
      return internalError('Failed to load tags', { error: tagsError.message });
    }

    return NextResponse.json(tags || []);
  } catch (error) {
    logger.error('Error in GET /api/ops/companies/[id]/tags:', error);
    return internalError('Failed to load tags', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to add tags');
    }

    const { id: companyId } = params;
    const body = await request.json();
    const { tag_name } = body;

    if (!tag_name || typeof tag_name !== 'string' || tag_name.trim().length === 0) {
      return badRequest('Tag name is required');
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      if (companyError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error checking company:', companyError);
      return internalError('Failed to check company', { error: companyError?.message });
    }

    // Add tag (upsert to handle duplicates gracefully)
    const { data: tag, error: tagError } = await supabase
      .from('company_tags')
      .insert({
        company_id: companyId,
        tag_name: tag_name.trim(),
      })
      .select()
      .single();

    if (tagError) {
      // If duplicate, return existing tag
      if (tagError.code === '23505') {
        const { data: existingTag } = await supabase
          .from('company_tags')
          .select('*')
          .eq('company_id', companyId)
          .eq('tag_name', tag_name.trim())
          .single();
        return NextResponse.json(existingTag);
      }
      logger.error('Error adding tag:', tagError);
      return internalError('Failed to add tag', { error: tagError.message });
    }

    // Create activity feed item
    try {
      await createActivityFeedItem(supabase, {
        company_id: companyId,
        related_entity_id: companyId,
        related_entity_type: 'company',
        event_type: 'tag_added',
        message: `Tag "${tag_name.trim()}" added to company ${company.name}`,
      });
    } catch (activityError) {
      logger.error('Error creating activity feed item:', activityError);
    }

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/companies/[id]/tags:', error);
    return internalError('Failed to add tag', { error: error instanceof Error ? error.message : 'Unknown error' });
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
      return unauthorized('You must be logged in to remove tags');
    }

    const { id: companyId } = params;
    const { searchParams } = new URL(request.url);
    const tagName = searchParams.get('tag_name');

    if (!tagName) {
      return badRequest('Tag name is required');
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      if (companyError?.code === 'PGRST116') {
        return notFound('Company not found');
      }
      logger.error('Error checking company:', companyError);
      return internalError('Failed to check company', { error: companyError?.message });
    }

    // Remove tag
    const { error: deleteError } = await supabase
      .from('company_tags')
      .delete()
      .eq('company_id', companyId)
      .eq('tag_name', tagName);

    if (deleteError) {
      logger.error('Error removing tag:', deleteError);
      return internalError('Failed to remove tag', { error: deleteError.message });
    }

    // Create activity feed item
    try {
      await createActivityFeedItem(supabase, {
        company_id: companyId,
        related_entity_id: companyId,
        related_entity_type: 'company',
        event_type: 'tag_removed',
        message: `Tag "${tagName}" removed from company ${company.name}`,
      });
    } catch (activityError) {
      logger.error('Error creating activity feed item:', activityError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/ops/companies/[id]/tags:', error);
    return internalError('Failed to remove tag', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

