/**
 * Email branding utilities
 * Handles fetching organization branding and app branding for emails
 */

import { createAdminSupabaseClient } from './supabaseAdmin';
import { getOrganizationContextById } from './organizationContext';
import logger from './utils/logger';
import { getAppUrl } from './utils/appUrl';

export interface EmailBranding {
  logoUrl: string | null;
  organizationName: string | null;
  appName: string;
  appLogoUrl: string;
}

/**
 * Get app branding (logo and name)
 */
export async function getAppBranding(): Promise<{ logoUrl: string; appName: string }> {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data: setting } = await adminClient
      .from('admin_settings')
      .select('value')
      .eq('key', 'system_app_name')
      .eq('category', 'system')
      .single();

    const appName = setting?.value ? String(setting.value) : 'FullStack Method™ App';
    // Use PNG for emails as it has better email client support than SVG
    const appLogoUrl = `${getAppUrl()}/fullstack_logo.png`;

    return { logoUrl: appLogoUrl, appName };
  } catch (error) {
    logger.debug('[EmailBranding] Error loading app branding, using defaults');
    return {
      logoUrl: `${getAppUrl()}/fullstack_logo.png`,
      appName: 'FullStack Method™ App',
    };
  }
}

/**
 * Get email branding for an organization
 * Returns organization logo if available, otherwise app logo
 * Logo priority: organization logo first, then app logo as fallback
 */
export async function getEmailBranding(
  organizationId?: string | null
): Promise<EmailBranding> {
  const appBranding = await getAppBranding();
  
  if (!organizationId) {
    return {
      logoUrl: appBranding.logoUrl,
      organizationName: null,
      appName: appBranding.appName,
      appLogoUrl: appBranding.logoUrl,
    };
  }

  try {
    // Use admin client to fetch organization branding
    const adminClient = createAdminSupabaseClient();
    const { data: organization } = await adminClient
      .from('organizations')
      .select('logo_url, icon_url, name')
      .eq('id', organizationId)
      .single();

    if (organization) {
      // Priority: organization logo_url, then icon_url, then app logo
      const orgLogoUrl = organization.logo_url || organization.icon_url || null;
      
      return {
        logoUrl: orgLogoUrl || appBranding.logoUrl, // Always fallback to app logo
        organizationName: organization.name,
        appName: appBranding.appName,
        appLogoUrl: appBranding.logoUrl,
      };
    }
  } catch (error) {
    logger.debug('[EmailBranding] Error fetching organization branding:', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Fallback to app branding - always return app logo
  return {
    logoUrl: appBranding.logoUrl,
    organizationName: null,
    appName: appBranding.appName,
    appLogoUrl: appBranding.logoUrl,
  };
}

/**
 * Brand color constants for email templates
 */
export const EMAIL_BRAND_COLORS = {
  primary: '#007bff',
  secondary: '#6c757d',
  success: '#28a745',
  text: '#333',
  textLight: '#666',
  background: '#f8f9fa',
  border: '#e0e0e0',
  white: '#ffffff',
} as const;

