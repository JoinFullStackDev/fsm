import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { notifyProjectMemberAdded } from '@/lib/notifications';
import { unauthorized, notFound, badRequest, forbidden, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

// POST - Add a member to a project
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to add project members');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User not found');
    }

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id || !role) {
      return badRequest('user_id and role are required');
    }

    // Verify user is project owner or admin
    // Fetch both owner_id and name in one query
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id, name')
      .eq('id', params.id)
      .single();

    if (projectError || !project) {
      return notFound('Project not found');
    }

    const isOwner = project.owner_id === userData.id;
    const isAdmin = userData.role === 'admin';
    const isPM = userData.role === 'pm';

    if (!isOwner && !isAdmin && !isPM) {
      return forbidden('Only project owners, admins, or PMs can add members');
    }

    // Check if member already exists
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', user_id)
      .single();

    if (existingMember) {
      return badRequest('User is already a member of this project');
    }

    // Use admin client to bypass RLS for inserting members
    // This ensures the insert works even if RLS policies have issues
    const adminClient = createAdminSupabaseClient();
    const { data: member, error: memberError } = await adminClient
      .from('project_members')
      .insert({
        project_id: params.id,
        user_id,
        role,
      })
      .select()
      .single();

    if (memberError) {
      logger.error('[Project Member] Error adding member:', memberError);
      return internalError('Failed to add project member', { error: memberError.message });
    }

    const { data: addedBy } = await supabase
      .from('users')
      .select('name')
      .eq('id', userData.id)
      .single();

    // Create notification for added user
    if (project && addedBy) {
      notifyProjectMemberAdded(
        user_id,
        params.id,
        project.name,
        userData.id,
        addedBy.name
      ).catch((err) => {
        logger.error('[Project Member] Error creating notification:', err);
      });
    }

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    logger.error('[Project Member] Unexpected error:', error);
    return internalError('Failed to add project member', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

