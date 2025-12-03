import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { sendEmailWithRetry } from '@/lib/emailService';
import { getUserInvitationTemplate } from '@/lib/emailTemplates';
import { isEmailConfigured } from '@/lib/emailService';
import { getUserOrganizationId } from '@/lib/organizationContext';
import logger from '@/lib/utils/logger';
import { unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/utils/apiErrors';

// POST - Resend invitation email for a user
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in');
    }

    // Get current user and verify admin role
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role, name, organization_id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !currentUser) {
      return notFound('User');
    }

    if (currentUser.role !== 'admin') {
      return forbidden('Admin access required');
    }

    const adminClient = createAdminSupabaseClient();

    // Get the user to invite
    const { data: targetUser, error: targetError } = await adminClient
      .from('users')
      .select('id, email, name, auth_id, invited_by_admin, organization_id')
      .eq('id', params.id)
      .single();

    if (targetError || !targetUser) {
      return notFound('User not found');
    }

    // Verify user belongs to same organization
    if (targetUser.organization_id !== currentUser.organization_id) {
      return forbidden('Cannot resend invitation for user from another organization');
    }

    if (!targetUser.invited_by_admin) {
      return badRequest('User was not invited by admin');
    }

    // Check if email is configured
    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return badRequest('Email service is not configured');
    }

    // Check if user's email is already confirmed in Supabase Auth
    // If confirmed, we can't use invite type - need to use recovery type instead
    let authUser;
    try {
      const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(targetUser.auth_id);
      if (authUserError) {
        logger.warn('[Resend Invite] Could not fetch auth user:', {
          authId: targetUser.auth_id,
          error: authUserError.message,
        });
      } else {
        authUser = authUserData.user;
      }
    } catch (err) {
      logger.warn('[Resend Invite] Error fetching auth user:', err);
    }

    // Generate invitation link using Supabase admin API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (request.headers.get('origin') || 'http://localhost:3000');
    
    // If email is already confirmed, use recovery type instead of invite
    const linkType = authUser?.email_confirmed_at ? 'recovery' : 'invite';
    
    logger.info('[Resend Invite] Generating link:', {
      userId: params.id,
      email: targetUser.email,
      linkType,
      emailConfirmed: !!authUser?.email_confirmed_at,
    });

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: linkType,
      email: targetUser.email,
      options: {
        redirectTo: `${baseUrl}/auth/set-password`,
      },
    });

    if (linkError) {
      logger.error('[Resend Invite] Failed to generate invitation link:', {
        userId: params.id,
        email: targetUser.email,
        linkType,
        error: linkError.message,
        errorCode: (linkError as any).status,
        linkData,
      });
      return internalError('Failed to generate invitation link', {
        error: linkError.message || 'Unknown error generating link',
      });
    }

    // Extract invitation link from properties
    const invitationLink = linkData?.properties?.action_link;

    if (!invitationLink) {
      logger.error('[Resend Invite] Generated link data missing action_link:', {
        userId: params.id,
        email: targetUser.email,
        linkType,
        linkDataKeys: linkData ? Object.keys(linkData) : [],
        propertiesKeys: linkData?.properties ? Object.keys(linkData.properties) : [],
        linkData,
      });
      return internalError('Failed to generate invitation link - link data missing', {
        error: 'Invitation link was not returned from Supabase',
      });
    }

    logger.info('[Resend Invite] Successfully generated invitation link:', {
      userId: params.id,
      email: targetUser.email,
      linkType,
      hasLink: !!invitationLink,
    });

    // Get organization name for email
    const { data: orgData } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', targetUser.organization_id)
      .single();

    // Get email template
    const organizationId = targetUser.organization_id || null;
    const template = await getUserInvitationTemplate(
      targetUser.name || 'User',
      orgData?.name || 'Your Organization',
      invitationLink,
      currentUser.name || undefined,
      organizationId
    );

    // Send invitation email
    logger.info('[Resend Invite] Sending invitation email:', {
      email: targetUser.email,
      subject: template.subject,
      hasHtml: !!template.html,
      hasText: !!template.text,
    });

    const emailSendResult = await sendEmailWithRetry(
      targetUser.email,
      template.subject,
      template.html,
      template.text,
      undefined,
      undefined,
      organizationId
    );

    if (!emailSendResult.success) {
      logger.error('[Resend Invite] Failed to send invitation email:', {
        userId: params.id,
        email: targetUser.email,
        error: emailSendResult.error,
        subject: template.subject,
      });
      return internalError('Failed to send invitation email', {
        error: emailSendResult.error || 'Unknown error sending email. Please check email service configuration.',
      });
    }

    logger.info('[Resend Invite] Email sent successfully, updating invite timestamp');

    // Update invite timestamp
    await adminClient
      .from('users')
      .update({
        invite_created_at: new Date().toISOString(),
        invite_created_by: currentUser.id,
      })
      .eq('id', params.id);

    logger.info('[Resend Invite] Invitation email resent successfully', {
      userId: params.id,
      email: targetUser.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation email sent successfully',
      email: targetUser.email,
    });
  } catch (error) {
    logger.error('[Resend Invite] Unexpected error:', error);
    return internalError('Failed to resend invitation', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

