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
import { createMockProject, createMockUser } from '@/lib/test-helpers';

jest.mock('@/lib/supabaseServer');
jest.mock('@/lib/supabaseAdmin');
jest.mock('@/lib/organizationContext', () => ({
  getUserOrganizationId: jest.fn(),
}));
jest.mock('@/lib/notifications', () => ({
  notifyProjectCreated: jest.fn(),
}));
jest.mock('@/lib/emailNotifications', () => ({
  sendProjectCreatedEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/packageLimits', () => ({
  canCreateProject: jest.fn().mockResolvedValue({ allowed: true }),
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
jest.mock('@/lib/utils/csrf', () => ({
  requireCsrfToken: jest.fn().mockResolvedValue(null),
  shouldSkipCsrf: jest.fn().mockReturnValue(false),
}));

import { getUserOrganizationId } from '@/lib/organizationContext';

// Helper to generate test UUIDs (matching test-helpers.ts)
function generateTestUUID(seed: number = 1): string {
  const hex = seed.toString(16).padStart(8, '0');
  return `${hex}0000-0000-4000-8000-${hex}00000000`;
}

describe('/api/projects', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  const mockAdminClient = {
    from: jest.fn(),
  };

  // Valid UUID for organization_id
  const validOrgId = '00000123-0000-4000-8000-000001230000';

  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    (createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdminClient);
    (getUserOrganizationId as jest.Mock).mockResolvedValue(validOrgId);
    // Mock RPC call for user_organization_id
    mockSupabaseClient.rpc = jest.fn().mockResolvedValue({ data: validOrgId, error: null });
  });

  describe('GET', () => {
    it('should return projects for authenticated user', async () => {
      const mockUser = createMockUser({ 
        role: 'engineer',
        organization_id: validOrgId,
        is_super_admin: false,
      }); // Non-admin user
      const mockProjects = [createMockProject(), createMockProject({ id: generateTestUUID(101) })];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id, email: 'test@example.com' },
        },
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { 
            id: mockUser.id, 
            role: mockUser.role,
            organization_id: mockUser.organization_id,
            is_super_admin: mockUser.is_super_admin,
          },
          error: null,
        }),
      };

      // Mock admin client queries (route uses adminClient for most queries)
      // 1. Owned projects query: adminClient.from('projects').select('id').eq('organization_id').eq('owner_id')
      // The route chains: .eq('organization_id').eq('owner_id') then awaits the result
      // Supabase query builders are thenable, so we need to make it awaitable
      const ownedProjectsResult = {
        data: mockProjects.map(p => ({ id: p.id })),
        error: null,
      };
      const mockOwnedProjectsQuery: any = {
        select: jest.fn(function() { return this; }),
        eq: jest.fn(function() { return this; }),
        then: jest.fn((resolve) => Promise.resolve(ownedProjectsResult).then(resolve)),
        catch: jest.fn(),
      };

      // 2. Member projects query: adminClient.from('project_members').select(...).eq('user_id')
      const mockMemberProjectsQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [], // No member projects for this test
          error: null,
        }),
      };

      // 3. Verified projects query: adminClient.from('projects').select('id, organization_id').in('id').eq('organization_id')
      const mockVerifiedProjectsQuery: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockProjects.map(p => ({ id: p.id, organization_id: validOrgId })),
          error: null,
        }),
      };

      // 4. Final projects query: adminClient.from('projects').select(...).eq('organization_id').in('id').order().range()
      const mockFinalProjectsQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockProjects,
          error: null,
          count: mockProjects.length,
        }),
      };

      // Mock regular client: users table lookup
      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery); // users table

      // Mock admin client queries in order:
      mockAdminClient.from
        .mockReturnValueOnce(mockOwnedProjectsQuery) // 1. owned projects
        .mockReturnValueOnce(mockMemberProjectsQuery) // 2. member projects
        .mockReturnValueOnce(mockVerifiedProjectsQuery) // 3. verified projects
        .mockReturnValueOnce(mockFinalProjectsQuery); // 4. final projects query

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const data = await response.json();

      if (response.status !== 200) {
        console.error('Test failed with status:', response.status, 'Error:', JSON.stringify(data, null, 2));
      }

      expect(response.status).toBe(200);
      expect(data).toEqual({
        data: mockProjects,
        total: mockProjects.length,
        limit: 10,
        offset: 0,
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('You must be logged in to view projects');
    });

    it('should return 404 when user not found', async () => {
      const mockUser = createMockUser();
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id, email: 'test@example.com' },
        },
      });
      (getUserOrganizationId as jest.Mock).mockResolvedValue(null);

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      const mockAdminUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockUserQuery);
      mockAdminClient.from.mockReturnValue(mockAdminUserQuery);

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
    });
  });

  describe('POST', () => {
    it('should create project with valid data', async () => {
      const mockUser = createMockUser({ 
        organization_id: validOrgId,
        email: 'test@example.com',
        name: 'Test User',
      });
      const newProject = createMockProject({ name: 'New Project' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id, email: 'test@example.com' },
        },
      });

      const mockAdminUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: mockUser.id,
            organization_id: mockUser.organization_id,
            email: mockUser.email,
            name: mockUser.name,
          },
          error: null,
        }),
      };

      // Mock RPC call for create_project_with_org
      mockAdminClient.rpc = jest.fn().mockResolvedValue({
        data: newProject,
        error: null,
      });

      const mockAdminProjectQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: newProject,
          error: null,
        }),
      };

      // Mock for notification creator lookup (if needed)
      const mockCreatorQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { name: 'Test User' },
          error: null,
        }),
      };

      // The route uses admin client for both user lookup and project insert
      mockAdminClient.from
        .mockReturnValueOnce(mockAdminUserQuery) // User lookup
        .mockReturnValueOnce(mockAdminProjectQuery); // Project insert
      mockSupabaseClient.from
        .mockReturnValueOnce(mockCreatorQuery); // Creator lookup for notifications

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Project',
          description: 'Test description',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('New Project');
    });

    it('should return 400 when name is missing', async () => {
      const mockUser = createMockUser();
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id, email: 'test@example.com' },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Test description',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Project name is required');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Project',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('You must be logged in to create projects');
    });
  });
});
