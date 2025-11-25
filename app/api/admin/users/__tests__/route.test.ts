// Mock Next.js server modules before imports
jest.mock('next/server', () => {
  const mockNextRequest = class NextRequest {
    constructor(public url: string, public init?: any) {}
    async json() {
      return this.init?.body ? JSON.parse(this.init.body) : {};
    }
  };

  const mockNextResponse = {
    json: (data: any, init?: any) => {
      const Response = global.Response;
      return Response.json(data, init);
    },
  };

  return {
    NextRequest: mockNextRequest,
    NextResponse: mockNextResponse,
  };
});

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { createMockUser } from '@/lib/test-helpers';

jest.mock('@/lib/supabaseServer');
jest.mock('@/lib/supabaseAdmin');
jest.mock('@/lib/utils/passwordGenerator', () => ({
  generateSecurePassword: jest.fn(() => 'generated-password'),
}));
jest.mock('@/lib/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('/api/admin/users', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  };

  const mockAdminClient = {
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    (createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdminClient);
  });

  describe('GET', () => {
    it('should return users for admin', async () => {
      const mockAdmin = createMockUser({ role: 'admin' });
      const mockUsers = [
        createMockUser({ id: 'user-1' }),
        createMockUser({ id: 'user-2' }),
      ];

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockAdmin,
          error: null,
        }),
      };

      const mockUsersQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockUsers,
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockUsersQuery);

      const request = new NextRequest('http://localhost:3000/api/admin/users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toEqual(mockUsers);
    });

    it('should return 403 for non-admin users', async () => {
      const mockUser = createMockUser({ role: 'engineer' });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockUser,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockUserQuery);

      const request = new NextRequest('http://localhost:3000/api/admin/users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      const request = new NextRequest('http://localhost:3000/api/admin/users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
    });
  });

  describe('POST', () => {
    it('should create user when admin', async () => {
      const mockAdmin = createMockUser({ role: 'admin' });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockAdmin.id, role: mockAdmin.role },
          error: null,
        }),
      };

      const mockCheckUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      const mockCheckExistingRecordQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      const mockInsertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'new-user', email: 'new@example.com', name: 'New User', role: 'engineer' },
          error: null,
        }),
      };

      mockAdminClient.auth.admin.createUser.mockResolvedValue({
        data: {
          user: { id: 'auth-new', email: 'new@example.com' },
        },
        error: null,
      });

      const mockFinalUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'new-user', email: 'new@example.com', name: 'New User', role: 'engineer' },
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockCheckUserQuery);

      mockAdminClient.from
        .mockReturnValueOnce(mockCheckExistingRecordQuery)
        .mockReturnValueOnce(mockInsertQuery)
        .mockReturnValueOnce(mockFinalUserQuery);

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          role: 'engineer',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      if (response.status !== 201) {
        console.log('Error response:', data);
      }

      expect(response.status).toBe(201);
      expect(data.user).toBeDefined();
      expect(data.temporaryPassword).toBeDefined();
    });

    it('should return 400 when required fields are missing', async () => {
      const mockAdmin = createMockUser({ role: 'admin' });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockAdmin,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockUserQuery);

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New User',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 400 for invalid email format', async () => {
      const mockAdmin = createMockUser({ role: 'admin' });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockAdmin,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockUserQuery);

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New User',
          email: 'invalid-email',
          role: 'engineer',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email format');
    });
  });
});

