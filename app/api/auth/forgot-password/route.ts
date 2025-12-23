import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { badRequest, internalError, notFound } from '@/lib/utils/apiErrors';
import { sendEmailWithRetry } from '@/lib/emailService';
import { getPasswordResetTemplate } from '@/lib/emailTemplates';
import { isEmailConfigured } from '@/lib/emailService';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import crypto from 'crypto';
import logger from '@/lib/utils/logger';
import { getAppUrl } from '@/lib/utils/appUrl';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/forgot-password
 * Request password reset - generates token and sends email
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for authentication endpoints
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.auth);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return badRequest('Email is required');
    }

    // Check if email service is configured
    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return badRequest('Email service is not configured. Please contact your administrator.');
    }

    const adminClient = createAdminSupabaseClient();

    // Find user by email
    const { data: user, error: userError } = await adminClient
      .from('users')
      .select('id, email, name, auth_id, organization_id')
      .eq('email', email.trim().toLowerCase())
      .single();

    // Always return success to prevent email enumeration
    // But log the error for debugging
    if (userError || !user) {
      logger.debug('[Password Reset] User not found:', email);
      // Return success even if user doesn't exist (security best practice)
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Check for recent password reset requests (rate limiting)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentTokens } = await adminClient
      .from('password_reset_tokens')
      .select('id')
      .eq('user_id', user.id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .gt('created_at', oneHourAgo);

    if (recentTokens && recentTokens.length > 0) {
      logger.debug('[Password Reset] Rate limit: recent token exists for user:', user.id);
      // Still return success to prevent timing attacks
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token in database
    const { error: tokenError } = await adminClient
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (tokenError) {
      logger.error('[Password Reset] Error creating token:', tokenError);
      return internalError('Failed to create password reset token');
    }

    // Generate reset link
    const baseUrl = getAppUrl();
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

    // Get email template
    const organizationId = user.organization_id || null;
    const template = await getPasswordResetTemplate(
      user.name || 'User',
      resetLink,
      organizationId
    );

    // Send email
    const emailSendResult = await sendEmailWithRetry(
      user.email,
      template.subject,
      template.html,
      template.text,
      undefined,
      undefined,
      organizationId
    );

    if (!emailSendResult.success) {
      logger.error('[Password Reset] Failed to send password reset email:', {
        email: user.email,
        error: emailSendResult.error,
        subject: template.subject,
      });
      // Don't fail the request, but log the error
      // In production, you might want to queue this for retry
    } else {
      logger.info('[Password Reset] Password reset email sent successfully', {
        email: user.email,
        subject: template.subject,
      });
    }

    // Always return success (even if email failed) to prevent email enumeration
    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error('[Password Reset] Error in forgot-password:', error);
    return internalError('Failed to process password reset request', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

