import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { notifyProjectCreated } from '@/lib/notifications';
import { unauthorized, notFound, internalError, badRequest } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view projects');
    }

    // Get user record with role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query with company join
    let query = supabase
      .from('projects')
      .select(`
        *,
        company:companies(id, name)
      `, { count: 'exact' });

    // If admin and filtering by company, show all projects for that company
    // Otherwise, filter by user ownership/membership
    if (userData.role === 'admin' && companyId) {
      query = query.eq('company_id', companyId);
    } else {
      // Get project IDs where user is a member
      const { data: memberProjects, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userData.id);

      if (memberError) {
        logger.error('Error loading project members:', memberError);
        return internalError('Failed to load project members', { error: memberError.message });
      }

      const memberProjectIds = (memberProjects || []).map((mp: any) => mp.project_id);
      
      // Build OR condition: owner_id matches OR id is in member project IDs
      if (memberProjectIds.length > 0) {
        query = query.or(`owner_id.eq.${userData.id},id.in.(${memberProjectIds.join(',')})`);
      } else {
        // If user is not a member of any projects, only show owned projects
        query = query.eq('owner_id', userData.id);
      }
      
      // Filter by company_id if provided
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
    }

    query = query.order('updated_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: projects, error: projectsError, count } = await query;

    if (projectsError) {
      logger.error('Error loading projects:', projectsError);
      return internalError('Failed to load projects', { error: projectsError.message });
    }

    return NextResponse.json({
      data: projects || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error in GET /api/projects:', error);
    return internalError('Failed to load projects', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to create projects');
    }

    const body = await request.json();
    const { name, description, status, primary_tool, company_id } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Project name is required');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Verify company exists if company_id is provided
    if (company_id) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('id', company_id)
        .single();

      if (companyError || !company) {
        if (companyError?.code === 'PGRST116') {
          return badRequest('Company not found');
        }
        logger.error('Error checking company:', companyError);
        return internalError('Failed to check company', { error: companyError?.message });
      }
    }

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        owner_id: userData.id,
        name,
        description,
        status: status || 'idea',
        primary_tool: primary_tool || null,
        company_id: company_id || null,
        source: 'Manual', // Default for manually created projects
      })
      .select()
      .single();

    if (projectError) {
      logger.error('Error creating project:', projectError);
      return internalError('Failed to create project', { error: projectError.message });
    }

    // Create notification for project owner if different from creator
    if (project.owner_id && project.owner_id !== userData.id) {
      const { data: creator } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.id)
        .single();

      notifyProjectCreated(
        project.owner_id,
        userData.id,
        project.id,
        project.name,
        creator?.name || null
      ).catch((err) => {
        logger.error('[Project] Error creating notification:', err);
      });
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/projects:', error);
    return internalError('Failed to create project', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

