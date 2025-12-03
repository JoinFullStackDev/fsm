import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, badRequest, internalError, notFound, forbidden } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ScopeOfWork, SOWWithAllocations } from '@/types/project';

export const dynamic = 'force-dynamic';

// GET - Get all SOWs for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view scope of work');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Verify project access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, organization_id, owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Check access
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const projectInUserOrg = project.organization_id === organizationId;
    
    if (!isSuperAdmin && !isProjectOwner && !projectInUserOrg) {
      const { data: projectMember } = await adminClient
        .from('project_members')
        .select('id')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .single();
      
      if (!projectMember) {
        return forbidden('You do not have access to this project');
      }
    }

    // Get SOWs
    const { data: sows, error: sowsError } = await adminClient
      .from('project_scope_of_work')
      .select(`
        *,
        resource_allocations:sow_resource_allocations(*)
      `)
      .eq('project_id', params.id)
      .order('version', { ascending: false });

    if (sowsError) {
      logger.error('[SOW GET] Error loading SOWs:', sowsError);
      return internalError('Failed to load scope of work', { error: sowsError.message });
    }

    return NextResponse.json({ sows: sows || [] });
  } catch (error) {
    logger.error('[SOW GET] Unexpected error:', error);
    return internalError('Failed to load scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// POST - Create a new SOW
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to create scope of work');
    }

    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    const adminClient = createAdminSupabaseClient();
    
    // Verify project access
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, organization_id, owner_id')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    // Get user record
    const { data: userData } = await adminClient
      .from('users')
      .select('id, role, organization_id, is_super_admin')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return notFound('User not found');
    }

    // Check permissions - only owners, admins, or PMs can create SOW
    const isSuperAdmin = userData.role === 'admin' && userData.is_super_admin === true;
    const isProjectOwner = project.owner_id === userData.id;
    const isAdmin = userData.role === 'admin';
    const isPM = userData.role === 'pm';
    
    if (!isSuperAdmin && !isProjectOwner && !isAdmin && !isPM) {
      // Check if user is a project member with admin/pm role
      const { data: projectMember } = await adminClient
        .from('project_members')
        .select('role')
        .eq('project_id', params.id)
        .eq('user_id', userData.id)
        .single();
      
      if (!projectMember || (projectMember.role !== 'admin' && projectMember.role !== 'pm')) {
        return forbidden('Only project owners, admins, or PMs can create scope of work');
      }
    }

    const body = await request.json();
    const {
      title,
      description,
      objectives,
      deliverables,
      timeline,
      budget,
      assumptions,
      constraints,
      exclusions,
      acceptance_criteria,
      status,
      resource_allocations,
    } = body;

    if (!title || !title.trim()) {
      return badRequest('Title is required');
    }

    // Get next version number
    const { data: latestSOW } = await adminClient
      .from('project_scope_of_work')
      .select('version')
      .eq('project_id', params.id)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = latestSOW ? latestSOW.version + 1 : 1;

    // Create SOW
    const { data: sow, error: sowError } = await adminClient
      .from('project_scope_of_work')
      .insert({
        project_id: params.id,
        version: nextVersion,
        title: title.trim(),
        description: description || null,
        objectives: objectives || [],
        deliverables: deliverables || [],
        timeline: timeline || {},
        budget: budget || {},
        assumptions: assumptions || [],
        constraints: constraints || [],
        exclusions: exclusions || [],
        acceptance_criteria: acceptance_criteria || [],
        status: status || 'draft',
        created_by: userData.id,
      })
      .select()
      .single();

    if (sowError) {
      logger.error('[SOW POST] Error creating SOW:', sowError);
      return internalError('Failed to create scope of work', { error: sowError.message });
    }

    // Create resource allocations if provided
    if (resource_allocations && Array.isArray(resource_allocations) && resource_allocations.length > 0) {
      const allocationsToInsert = resource_allocations.map((alloc: any) => ({
        sow_id: sow.id,
        user_id: alloc.user_id,
        role: alloc.role,
        allocated_hours_per_week: alloc.allocated_hours_per_week,
        allocated_percentage: alloc.allocated_percentage || null,
        start_date: alloc.start_date,
        end_date: alloc.end_date,
        notes: alloc.notes || null,
      }));

      const { error: allocError } = await adminClient
        .from('sow_resource_allocations')
        .insert(allocationsToInsert);

      if (allocError) {
        logger.error('[SOW POST] Error creating resource allocations:', allocError);
        // Don't fail the whole request, just log the error
      }
    }

    // Fetch the complete SOW with allocations
    const { data: completeSOW } = await adminClient
      .from('project_scope_of_work')
      .select(`
        *,
        resource_allocations:sow_resource_allocations(*)
      `)
      .eq('id', sow.id)
      .single();

    return NextResponse.json(completeSOW, { status: 201 });
  } catch (error) {
    logger.error('[SOW POST] Unexpected error:', error);
    return internalError('Failed to create scope of work', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

