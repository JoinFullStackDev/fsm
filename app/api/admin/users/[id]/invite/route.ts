import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { generateSecurePassword } from '@/lib/utils/passwordGenerator';

// GET - Get or regenerate invite password for a user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user and verify admin role
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Get the user to invite
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('id, email, auth_id, invited_by_admin')
      .eq('id', params.id)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!targetUser.invited_by_admin) {
      return NextResponse.json(
        { error: 'User was not invited by admin' },
        { status: 400 }
      );
    }

    // Generate new temporary password
    const temporaryPassword = generateSecurePassword(16);

    // Update auth user password using admin client
    const adminClient = createAdminSupabaseClient();
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(
      targetUser.auth_id,
      {
        password: temporaryPassword,
      }
    );

    if (passwordError) {
      console.error('[Admin Users] Error updating password:', passwordError);
      return NextResponse.json(
        { error: 'Failed to generate invite password: ' + passwordError.message },
        { status: 500 }
      );
    }

    // Update invite timestamp
    await supabase
      .from('users')
      .update({
        invite_created_at: new Date().toISOString(),
        invite_created_by: currentUser.id,
      })
      .eq('id', params.id);

    return NextResponse.json({
      email: targetUser.email,
      temporaryPassword,
    });
  } catch (error) {
    console.error('[Admin Users] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

