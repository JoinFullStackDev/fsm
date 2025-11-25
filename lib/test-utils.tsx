import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/styles/theme';

/**
 * Custom render function that includes all providers
 * Use this instead of the default render from @testing-library/react
 * 
 * Note: ThemeProvider is mocked in jest.setup.js to avoid Emotion cache issues
 */
function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Create a mock Supabase client for testing
 */
export function createMockSupabaseClient() {
  return {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    })),
  };
}

/**
 * Create a mock session for testing
 */
export function createMockSession(userId: string = 'test-user-id', email: string = 'test@example.com') {
  return {
    user: {
      id: userId,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Date.now() / 1000 + 3600,
    token_type: 'bearer',
  };
}

/**
 * Wait for loading states to finish
 */
export async function waitForLoadingToFinish() {
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => {
    const loadingElements = document.querySelectorAll('[data-testid="loading"], [aria-busy="true"]');
    expect(loadingElements.length).toBe(0);
  });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Export renderWithProviders as default render
export { renderWithProviders };

