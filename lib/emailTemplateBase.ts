/**
 * Shared email template base
 * Provides consistent wrapper for all email templates
 */

import { getEmailBranding, EMAIL_BRAND_COLORS } from './emailBranding';
import { getAppUrl } from './utils/appUrl';

// Re-export EMAIL_BRAND_COLORS for convenience
export { EMAIL_BRAND_COLORS };

export interface EmailWrapperOptions {
  content: string;
  organizationId?: string | null;
  preheader?: string;
}

/**
 * Generate email wrapper with header and footer
 * Includes logo, branding, and consistent styling
 */
export async function generateEmailWrapper(options: EmailWrapperOptions): Promise<string> {
  const { content, organizationId, preheader } = options;
  const branding = await getEmailBranding(organizationId);

  // Always show a logo - use organization logo if available, otherwise use app logo
  const logoUrl = branding.logoUrl || branding.appLogoUrl;
  const logoAlt = branding.organizationName || branding.appName;
  
  const logoHtml = logoUrl
    ? `<div style="text-align: center; margin-bottom: 30px; padding: 20px 0;">
         <img src="${logoUrl}" alt="${logoAlt}" style="max-height: 60px; width: auto; display: block; margin: 0 auto;" />
       </div>`
    : '';

  const preheaderHtml = preheader
    ? `<div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
         ${preheader}
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${branding.appName}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${EMAIL_BRAND_COLORS.text}; background-color: ${EMAIL_BRAND_COLORS.background};">
  ${preheaderHtml}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${EMAIL_BRAND_COLORS.background};">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: ${EMAIL_BRAND_COLORS.white}; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid ${EMAIL_BRAND_COLORS.border};">
              ${logoHtml}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: ${EMAIL_BRAND_COLORS.background}; border-top: 1px solid ${EMAIL_BRAND_COLORS.border}; border-radius: 0 0 8px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; font-size: 12px; color: ${EMAIL_BRAND_COLORS.textLight}; line-height: 1.5;">
                    <p style="margin: 0 0 8px 0;">
                      This email was sent by ${branding.organizationName ? `${branding.organizationName} via ` : ''}${branding.appName}
                    </p>
                    <p style="margin: 0;">
                      ${getAppUrl()}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate button styles for email templates
 */
export function getButtonStyles(backgroundColor: string = EMAIL_BRAND_COLORS.primary): string {
  return `
    display: inline-block;
    padding: 12px 24px;
    background-color: ${backgroundColor};
    color: ${EMAIL_BRAND_COLORS.white};
    text-decoration: none;
    border-radius: 4px;
    font-weight: 600;
    font-size: 16px;
    line-height: 1.5;
    text-align: center;
  `;
}

/**
 * Generate button HTML for email templates
 */
export function generateButton(
  text: string,
  url: string,
  backgroundColor: string = EMAIL_BRAND_COLORS.primary
): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="text-align: center;">
          <a href="${url}" style="${getButtonStyles(backgroundColor)}">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

