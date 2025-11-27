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
import { createMockProject, createMockUser } from '@/lib/test-helpers';

jest.mock('@/lib/supabaseServer');
jest.mock('@/lib/notifications', () => ({
  notifyProjectCreated: jest.fn(),
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

describe('/api/projects', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET', () => {
    it('should return projects for authenticated user', async () => {
      const mockUser = createMockUser({ role: 'engineer' }); // Non-admin user
      const mockProjects = [createMockProject(), createMockProject({ id: 'project-2' })];

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
          data: { id: mockUser.id, role: mockUser.role },
          error: null,
        }),
      };

      // Mock project_members query (for non-admin users)
      // Returns empty array, so code will use .eq('owner_id', userData.id) path
      const mockProjectMembersQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      // Create a chainable query builder for projects
      // Since memberProjectIds is empty, code will use .eq('owner_id', userData.id)
      // The builder needs to support: select() -> eq() -> order() -> range()
      // select() is called with { count: 'exact' } so it needs to handle that
      const mockProjectsQueryBuilder: any = {};
      mockProjectsQueryBuilder.select = jest.fn().mockReturnValue(mockProjectsQueryBuilder);
      mockProjectsQueryBuilder.eq = jest.fn().mockReturnValue(mockProjectsQueryBuilder);
      mockProjectsQueryBuilder.or = jest.fn().mockReturnValue(mockProjectsQueryBuilder);
      mockProjectsQueryBuilder.order = jest.fn().mockReturnValue(mockProjectsQueryBuilder);
      mockProjectsQueryBuilder.range = jest.fn().mockResolvedValue({
        data: mockProjects,
        error: null,
        count: mockProjects.length,
      });

      // Mock the from() calls in order as they appear in the route:
      // 1. users table (line 20 - for user lookup)
      // 2. projects table (line 37 - start projects query with select)
      // 3. project_members table (line 50 - to check membership, inside else block)
      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery) // 1. users table
        .mockReturnValueOnce(mockProjectsQueryBuilder) // 2. projects table (called first, before project_members check)
        .mockReturnValueOnce(mockProjectMembersQueryBuilder); // 3. project_members table

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const data = await response.json();


      expect(response.status).toBe(200);
      expect(data).toEqual({
        data: mockProjects,
        total: mockProjects.length,
        limit: 10,
        offset: 0,
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('You must be logged in to view projects');
    });

    it('should return 404 when user not found', async () => {
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
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockUserQuery);

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
    });
  });

  describe('POST', () => {
    it('should create project with valid data', async () => {
      const mockUser = createMockUser();
      const newProject = createMockProject({ name: 'New Project' });

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

      const mockProjectQuery = {
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

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectQuery)
        .mockReturnValueOnce(mockCreatorQuery);

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
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
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
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
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
