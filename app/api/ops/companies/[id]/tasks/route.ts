import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { createActivityFeedItem } from '@/lib/ops/activityFeed';
import type { OpsTask, OpsTaskWithRelations } from '@/types/ops';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view tasks');
    }

    const { id: companyId } = params;
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');

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

    // Build query - get tasks for company and optionally filter by contact
    let query = supabase
      .from('ops_tasks')
      .select(`
        *,
        contact:company_contacts(id, first_name, last_name, email),
        assigned_user:users!ops_tasks_assigned_to_fkey(id, name, email),
        company:companies(id, name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      logger.error('Error loading tasks:', tasksError);
      return internalError('Failed to load tasks', { error: tasksError.message });
    }

    // Transform to match OpsTaskWithRelations type
    const tasksWithRelations: OpsTaskWithRelations[] = (tasks || []).map((task: any) => ({
      ...task,
      contact: task.contact || null,
      assigned_user: task.assigned_user || null,
      company: task.company || undefined,
    }));

    return NextResponse.json(tasksWithRelations);
  } catch (error) {
    logger.error('Error in GET /api/ops/companies/[id]/tasks:', error);
    return internalError('Failed to load tasks', { error: error instanceof Error ? error.message : 'Unknown error' });
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
      return unauthorized('You must be logged in to create tasks');
    }

    const { id: companyId } = params;
    const body = await request.json();
    const { title, description, notes, contact_id, assigned_to, due_date } = body;

    // Validate
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return badRequest('Task title is required');
    }

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

    // Verify contact exists if provided
    if (contact_id) {
      const { data: contact, error: contactError } = await supabase
        .from('company_contacts')
        .select('id, company_id')
        .eq('id', contact_id)
        .single();

      if (contactError || !contact) {
        return badRequest('Contact not found');
      }
      if (contact.company_id !== companyId) {
        return badRequest('Contact does not belong to this company');
      }
    }

    // Create task
    const { data: task, error: taskError } = await supabase
      .from('ops_tasks')
      .insert({
        company_id: companyId,
        contact_id: contact_id || null,
        title: title.trim(),
        description: description?.trim() || null,
        notes: notes || null,
        comments: [],
        assigned_to: assigned_to || null,
        due_date: due_date || null,
      })
      .select()
      .single();

    if (taskError) {
      logger.error('Error creating task:', taskError);
      return internalError('Failed to create task', { error: taskError.message });
    }

    // Create activity feed item
    try {
      await createActivityFeedItem(supabase, {
        company_id: companyId,
        related_entity_id: task.id,
        related_entity_type: 'task',
        event_type: 'task_created',
        message: `Task "${task.title}" was created`,
      });
    } catch (activityError) {
      logger.error('Error creating activity feed item:', activityError);
      // Don't fail the request if activity feed creation fails
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/companies/[id]/tasks:', error);
    return internalError('Failed to create task', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

