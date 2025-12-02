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
jest.mock('@/lib/utils/csrf', () => ({
  requireCsrfToken: jest.fn().mockResolvedValue(null),
  shouldSkipCsrf: jest.fn().mockReturnValue(false),
}));

// Helper to generate test UUIDs
function generateTestUUID(seed: number = 1): string {
  const hex = seed.toString(16).padStart(8, '0');
  return `${hex}0000-0000-4000-8000-${hex}00000000`;
}

describe('/api/projects/[id]', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
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
  });

  describe('GET', () => {
    it('should return project with phases', async () => {
      const mockUser = createMockUser({ organization_id: validOrgId });
      const mockProject = createMockProject({ organization_id: validOrgId });
      const mockPhases = [
        { phase_number: 1, phase_name: 'Phase 1', completed: false },
        { phase_number: 2, phase_name: 'Phase 2', completed: false },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id },
        },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: validOrgId, is_super_admin: false },
          error: null,
        }),
      };

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockProject, organization_id: validOrgId },
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}`);
      const response = await GET(request, { params: { id: mockProject.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockProject.id);
      expect(data.phases).toEqual(mockPhases);
    });

    it('should return 404 when project not found', async () => {
      const mockUser = createMockUser({ organization_id: validOrgId });
      const mockProject = createMockProject();
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id },
        },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: validOrgId, is_super_admin: false },
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}`);
      const response = await GET(request, { params: { id: mockProject.id } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}`);
      const response = await GET(request, { params: { id: mockProject.id } });
      const data = await response.json();

      expect(response.status).toBe(401);
    });
  });

  describe('PUT', () => {
    it('should update project', async () => {
      const mockUser = createMockUser({ organization_id: validOrgId });
      const mockProject = createMockProject({ organization_id: validOrgId });
      const updatedProject = { ...mockProject, name: 'Updated Name' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id },
        },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: validOrgId, is_super_admin: false },
          error: null,
        }),
      };

      const mockProjectCheckQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockProject.id, template_id: null, organization_id: validOrgId },
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      });

      const response = await PUT(request, { params: { id: mockProject.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Updated Name');
    });

    it('should return 500 when project update fails', async () => {
      const mockUser = createMockUser({ organization_id: validOrgId });
      const mockProject = createMockProject({ organization_id: validOrgId });
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id },
        },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: validOrgId, is_super_admin: false },
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
                data: { id: mockProject.id, template_id: null, organization_id: validOrgId },
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      });

      const response = await PUT(request, { params: { id: mockProject.id } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('DELETE', () => {
    it('should delete project when user is admin', async () => {
      const mockUser = createMockUser({ role: 'admin', organization_id: validOrgId });
      const mockProject = createMockProject({ organization_id: validOrgId });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id },
        },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: validOrgId, is_super_admin: false },
          error: null,
        }),
      };

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockProject.id, organization_id: validOrgId },
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: mockProject.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Project deleted successfully');
    });
  });
});

