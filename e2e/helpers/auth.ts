import { Page } from '@playwright/test';

/**
 * Sets up mock authentication state for e2e tests
 * This mocks Supabase auth cookies to simulate an authenticated user
 */
export async function setupAuth(page: Page, options?: {
  userId?: string;
  email?: string;
  role?: string;
  organizationId?: string;
}) {
  const userId = options?.userId || 'test-user-id';
  const email = options?.email || 'test@example.com';
  const role = options?.role || 'pm';
  const organizationId = options?.organizationId || 'test-org-id';

  // Mock Supabase auth session cookie
  // Supabase uses cookies like: sb-<project-ref>-auth-token
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'placeholder';
  
  // Create a mock session token (JWT-like structure)
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const mockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: userId,
      email,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: {
        name: 'Test User',
        role,
      },
    },
  };

  // Set auth cookies that Supabase expects (multiple cookie formats)
  await page.context().addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: JSON.stringify(mockSession),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: `sb-${projectRef}-auth-token-code-verifier`,
      value: 'mock-code-verifier',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    // Also set the session cookie format that middleware might check
    {
      name: `sb-${projectRef}-auth-token.0`,
      value: JSON.stringify(mockSession),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // Also set localStorage for client-side auth checks
  await page.addInitScript((userData) => {
    if (typeof window !== 'undefined') {
      // Mock Supabase client's getSession to return our mock session
      const mockSession = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: userData.userId,
          email: userData.email,
          email_confirmed_at: new Date().toISOString(),
          user_metadata: {
            name: 'Test User',
            role: userData.role,
          },
        },
      };
      
      // Store in localStorage for client-side access
      localStorage.setItem(`sb-${window.location.hostname}-auth-token`, JSON.stringify(mockSession));
    }
  }, { userId, email, role, organizationId });

  // Mock API routes that check user data
  await page.route('**/api/auth/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: userId,
          email,
          role,
          organization_id: organizationId,
          name: 'Test User',
        },
      }),
    });
  });

  // Mock organization context API
  await page.route('**/api/organization/context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organization: {
          id: organizationId,
          name: 'Test Organization',
        },
        subscription: null,
        package: {
          features: {
            ai_features_enabled: true,
          },
        },
      }),
    });
  });
}

/**
 * Sets up admin authentication state
 */
export async function setupAdminAuth(page: Page) {
  return setupAuth(page, {
    userId: 'admin-user-id',
    email: 'admin@example.com',
    role: 'admin',
    organizationId: 'test-org-id',
  });
}

