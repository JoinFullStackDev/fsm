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
import { GET, PUT, DELETE } from '../route';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { createMockProject, createMockUser } from '@/lib/test-helpers';

jest.mock('@/lib/supabaseServer');
jest.mock('@/lib/supabaseAdmin');
jest.mock('@/lib/organizationContext', () => ({
  getUserOrganizationId: jest.fn(),
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

describe('/api/projects/[id]', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  };

  const mockAdminClient = {
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    (createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdminClient);
    (getUserOrganizationId as jest.Mock).mockResolvedValue('org-123');
  });

  describe('GET', () => {
    it('should return project with phases', async () => {
      const mockProject = createMockProject({ organization_id: 'org-123' });
      const mockPhases = [
        { phase_number: 1, phase_name: 'Phase 1', completed: false },
        { phase_number: 2, phase_name: 'Phase 2', completed: false },
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
          data: { id: 'user-1', role: 'engineer', organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockProject, organization_id: 'org-123' },
          error: null,
        }),
      };

      const mockPhasesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockPhases,
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery) // User lookup
        .mockReturnValueOnce(mockProjectQuery) // Project lookup
        .mockReturnValueOnce(mockPhasesQuery); // Phases lookup

      const request = new NextRequest('http://localhost:3000/api/projects/project-1');
      const response = await GET(request, { params: { id: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockProject.id);
      expect(data.phases).toEqual(mockPhases);
    });

    it('should return 404 when project not found', async () => {
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
          data: { id: 'user-1', role: 'engineer', organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectQuery);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1');
      const response = await GET(request, { params: { id: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      const request = new NextRequest('http://localhost:3000/api/projects/project-1');
      const response = await GET(request, { params: { id: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(401);
    });
  });

  describe('PUT', () => {
    it('should update project', async () => {
      const mockUser = createMockUser({ organization_id: 'org-123' });
      const mockProject = createMockProject({ organization_id: 'org-123' });
      const updatedProject = { ...mockProject, name: 'Updated Name' };

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
          data: { id: mockUser.id, role: mockUser.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      const mockProjectCheckQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'project-1', template_id: null, organization_id: 'org-123' },
          error: null,
        }),
      };

      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: updatedProject,
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery) // User lookup
        .mockReturnValueOnce(mockProjectCheckQuery) // Project check
        .mockReturnValueOnce(mockUpdateQuery); // Update

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      });

      const response = await PUT(request, { params: { id: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Updated Name');
    });

    it('should return 500 when project update fails', async () => {
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
          data: { id: 'user-1', role: 'engineer', organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return mockUserQuery;
        }
        if (table === 'projects') {
          callCount++;
          // First call: check if project exists (should succeed)
          if (callCount === 1) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'project-1', template_id: null, organization_id: 'org-123' },
                error: null,
              }),
            };
          }
          // Second call: update project (should fail)
          if (callCount === 2) {
            return {
              update: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            };
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };
      });

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      });

      const response = await PUT(request, { params: { id: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('DELETE', () => {
    it('should delete project when user is admin', async () => {
      const mockUser = createMockUser({ role: 'admin', organization_id: 'org-123' });

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
          data: { id: mockUser.id, role: mockUser.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'project-1', organization_id: 'org-123' },
          error: null,
        }),
      };

      const mockDeleteQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery) // User lookup
        .mockReturnValueOnce(mockProjectQuery) // Project check
        .mockReturnValueOnce(mockDeleteQuery); // Delete

      const request = new NextRequest('http://localhost:3000/api/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Project deleted successfully');
    });
  });
});

