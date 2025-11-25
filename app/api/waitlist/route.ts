import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const { email, name, role } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Check if email already exists in waitlist
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { message: 'You are already on the waitlist!' },
        { status: 200 }
      );
    }

    // Insert into waitlist
    // Build insert object conditionally to handle missing columns
    const insertData: { email: string; name?: string | null; role?: string | null; created_at?: string } = {
      email: email.toLowerCase(),
    };
    
    // Only include name and role if they are provided
    if (name !== undefined) {
      insertData.name = name || null;
    }
    if (role !== undefined) {
      insertData.role = role || null;
    }
    insertData.created_at = new Date().toISOString();

    const { error } = await supabase
      .from('waitlist')
      .insert(insertData);

    if (error) {
      logger.error('Error adding to waitlist:', error);
      return internalError('Failed to add to waitlist', { error: error.message });
    }

    return NextResponse.json(
      { message: 'Successfully added to waitlist!' },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error in waitlist route:', error);
    return internalError('Failed to process waitlist request', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

