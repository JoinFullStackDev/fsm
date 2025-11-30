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
import { getUserOrganizationId } from '@/lib/organizationContext';
import { createMockUser } from '@/lib/test-helpers';

jest.mock('@/lib/supabaseServer');
jest.mock('@/lib/supabaseAdmin');
jest.mock('@/lib/organizationContext', () => ({
  getUserOrganizationId: jest.fn(),
}));
jest.mock('@/lib/packageLimits', () => ({
  canAddUser: jest.fn().mockResolvedValue({ allowed: true }),
}));
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
      getUser: jest.fn(),
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
    (getUserOrganizationId as jest.Mock).mockResolvedValue('org-123');
  });

  describe('GET', () => {
    it('should return users for admin', async () => {
      const mockAdmin = createMockUser({ role: 'admin', organization_id: 'org-123' });
      const mockUsers = [
        createMockUser({ id: 'user-1', organization_id: 'org-123' }),
        createMockUser({ id: 'user-2', organization_id: 'org-123' }),
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'auth-123' },
        },
        error: null,
      });

      const mockAdminUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockAdmin.id, role: mockAdmin.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      const mockUsersQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockUsers,
          error: null,
        }),
      };
      // Make methods chainable
      mockUsersQuery.select.mockReturnValue(mockUsersQuery);
      mockUsersQuery.eq.mockReturnValue(mockUsersQuery);

      mockAdminClient.from
        .mockReturnValueOnce(mockAdminUserQuery) // Admin user lookup
        .mockReturnValueOnce(mockUsersQuery); // Users list query (also uses admin client)

      const request = new NextRequest('http://localhost:3000/api/admin/users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toEqual(mockUsers);
    });

    it('should return 403 for non-admin users', async () => {
      const mockUser = createMockUser({ role: 'engineer' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'auth-123' },
        },
        error: null,
      });

      const mockAdminUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockAdminUserQuery);

      const request = new NextRequest('http://localhost:3000/api/admin/users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
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

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'auth-123' },
        },
        error: null,
      });

      const mockAdminUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockAdmin.id, role: mockAdmin.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      // Check existing user by email (using regular supabase client)
      const mockCheckExistingEmailQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };

      // After auth user is created, check if user record exists (using admin client)
      const mockCheckExistingRecordQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };

      // Insert new user record (using admin client)
      const mockInsertQuery: any = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'new-user', email: 'new@example.com', name: 'New User', role: 'engineer', auth_id: 'auth-new' },
          error: null,
        }),
      };
      mockInsertQuery.insert.mockReturnValue(mockInsertQuery);
      mockInsertQuery.select.mockReturnValue(mockInsertQuery);

      mockAdminClient.auth.admin.createUser.mockResolvedValue({
        data: {
          user: { id: 'auth-new', email: 'new@example.com' },
        },
        error: null,
      });

      mockAdminClient.from
        .mockReturnValueOnce(mockAdminUserQuery) // Admin user lookup
        .mockReturnValueOnce(mockCheckExistingRecordQuery) // Check if user record exists after auth creation
        .mockReturnValueOnce(mockInsertQuery); // Insert new user record

      mockSupabaseClient.from
        .mockReturnValueOnce(mockCheckExistingEmailQuery); // Check existing user by email

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          role: 'engineer',
        }),
      });

      // Wait for the setTimeout in the route (500ms)
      const responsePromise = POST(request);
      await new Promise(resolve => setTimeout(resolve, 600));
      const response = await responsePromise;
      const data = await response.json();

      if (response.status !== 201) {
        console.log('Error response:', data);
      }

      expect(response.status).toBe(201);
      expect(data.user).toBeDefined();
      expect(data.invitationSent).toBe(true);
    });

    it('should return 400 when required fields are missing', async () => {
      const mockAdmin = createMockUser({ role: 'admin' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'auth-123' },
        },
        error: null,
      });

      const mockAdminUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockAdmin.id, role: mockAdmin.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockAdminUserQuery);

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

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: 'auth-123' },
        },
        error: null,
      });

      const mockAdminUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockAdmin.id, role: mockAdmin.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockAdminUserQuery);

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

