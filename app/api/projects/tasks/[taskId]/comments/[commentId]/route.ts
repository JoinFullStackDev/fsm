import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { taskId: string; commentId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Update comment (only if user owns it)
    const { data: comment, error } = await supabase
      .from('task_comments')
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.commentId)
      .eq('user_id', userData.id)
      .select(`
        *,
        user:users!task_comments_user_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('[Task Comments] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update comment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { taskId: string; commentId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete comment (only if user owns it)
    const { error } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', params.commentId)
      .eq('user_id', userData.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Task Comments] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete comment' },
      { status: 500 }
    );
  }
}

