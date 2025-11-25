import { renderHook, waitFor } from '@testing-library/react';
import { useRole } from '../useRole';
import { createSupabaseClient } from '@/lib/supabaseClient';

jest.mock('@/lib/supabaseClient');
jest.mock('@/lib/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useRole', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  it('should start with loading state', () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useRole());
    
    expect(result.current.loading).toBe(true);
    expect(result.current.role).toBe(null);
  });

  it('should return role when user is found', async () => {
    const mockSession = {
      user: {
        id: 'auth-123',
        email: 'test@example.com',
      },
    };

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'admin',
          auth_id: 'auth-123',
        },
        error: null,
      }),
    };

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    const { result } = renderHook(() => useRole());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.role).toBe('admin');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
  });

  it('should return null role when no session', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useRole());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.role).toBe(null);
  });

  it('should fallback to email lookup when auth_id lookup fails', async () => {
    const mockSession = {
      user: {
        id: 'auth-123',
        email: 'test@example.com',
      },
    };

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // First query fails (auth_id lookup)
    const mockQuery1 = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    };

    // Second query succeeds (email lookup)
    const mockQuery2 = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'engineer',
          auth_id: 'different-auth-id',
        },
        error: null,
      }),
    };

    mockSupabaseClient.from
      .mockReturnValueOnce(mockQuery1)
      .mockReturnValueOnce(mockQuery2);

    const { result } = renderHook(() => useRole());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.role).toBe('engineer');
    expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
  });

  it('should return null when user is not found', async () => {
    const mockSession = {
      user: {
        id: 'auth-123',
        email: 'test@example.com',
      },
    };

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    };

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    const { result } = renderHook(() => useRole());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.role).toBe(null);
  });
});

