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
import { GET, POST, PATCH } from '../route';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { createMockUser, createMockProject, createMockPhase } from '@/lib/test-helpers';

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

describe('/api/projects/[id]/phases', () => {
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
    it('should return phases for project', async () => {
      const mockUser = createMockUser({ organization_id: 'org-123' });
      const mockProject = createMockProject({ 
        owner_id: mockUser.id,
        organization_id: 'org-123',
      });
      const mockPhases = [
        createMockPhase({ phase_number: 1 }),
        createMockPhase({ phase_number: 2 }),
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
          data: { id: mockUser.id, role: mockUser.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: mockProject.owner_id, organization_id: 'org-123' },
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

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/phases');
      const response = await GET(request, { params: { id: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phases).toEqual(mockPhases);
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/phases');
      const response = await GET(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user is not owner or member', async () => {
      const mockUser = createMockUser({ id: 'user-2', organization_id: 'org-123' });
      const mockProject = createMockProject({ owner_id: 'user-1', organization_id: 'org-456' });

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
          data: { owner_id: mockProject.owner_id, organization_id: 'org-456' },
          error: null,
        }),
      };

      const mockMemberQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery) // User lookup
        .mockReturnValueOnce(mockProjectQuery) // Project lookup
        .mockReturnValueOnce(mockMemberQuery); // Member check

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/phases');
      const response = await GET(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(403);
    });
  });

  describe('POST', () => {
    it('should create phase when user is owner', async () => {
      const mockUser = createMockUser({ organization_id: 'org-123' });
      const mockProject = createMockProject({ 
        owner_id: mockUser.id,
        organization_id: 'org-123',
      });
      const newPhase = createMockPhase({ phase_number: 3 });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockUserQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };
      // Make methods chainable
      mockUserQuery.select.mockReturnValue(mockUserQuery);
      mockUserQuery.eq.mockReturnValue(mockUserQuery);

      const mockProjectQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: mockProject.owner_id, organization_id: 'org-123' },
          error: null,
        }),
      };
      // Make methods chainable
      mockProjectQuery.select.mockReturnValue(mockProjectQuery);
      mockProjectQuery.eq.mockReturnValue(mockProjectQuery);

      // Mock project_members query (user is owner, so this can return null)
      // The route uses .single() which returns error when not found
      // But the route destructures { data: projectMember }, so projectMember will be null
      // Since isOwner is true, isProjectMember will be true regardless
      const mockMemberQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };
      // Make methods chainable for: select() -> eq() -> eq() -> single()
      mockMemberQuery.select.mockReturnValue(mockMemberQuery);
      mockMemberQuery.eq.mockReturnValue(mockMemberQuery);

      const mockExistingPhasesQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        order: jest.fn(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      // Make methods chainable: select() -> eq() -> order() -> limit()
      mockExistingPhasesQuery.select.mockReturnValue(mockExistingPhasesQuery);
      mockExistingPhasesQuery.eq.mockReturnValue(mockExistingPhasesQuery);
      mockExistingPhasesQuery.order.mockReturnValue(mockExistingPhasesQuery);

      const mockInsertQuery: any = {
        insert: jest.fn(),
        select: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { 
            id: 'phase-new',
            project_id: 'project-1',
            phase_number: 1,
            phase_name: 'New Phase',
            display_order: 1,
            data: {},
            completed: false,
            is_active: true,
          },
          error: null,
        }),
      };
      // Make methods chainable: insert() -> select() -> single()
      mockInsertQuery.insert.mockReturnValue(mockInsertQuery);
      mockInsertQuery.select.mockReturnValue(mockInsertQuery);

      // Mock admin client's from() in case it's called (even though user lookup should succeed)
      const mockAdminUserQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };
      mockAdminUserQuery.select.mockReturnValue(mockAdminUserQuery);
      mockAdminUserQuery.eq.mockReturnValue(mockAdminUserQuery);
      mockAdminClient.from.mockReturnValue(mockAdminUserQuery);

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery) // User lookup (should succeed, so admin client won't be called)
        .mockReturnValueOnce(mockProjectQuery) // Project lookup
        .mockReturnValueOnce(mockMemberQuery) // Member check
        .mockReturnValueOnce(mockExistingPhasesQuery) // Existing phases check
        .mockReturnValueOnce(mockInsertQuery); // Phase insert

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/phases', {
        method: 'POST',
        body: JSON.stringify({
          phase_name: 'New Phase',
        }),
      });

      const response = await POST(request, { params: { id: 'project-1' } });
      const data = await response.json();

      if (response.status !== 201) {
        console.error('POST test error:', JSON.stringify(data, null, 2));
      }

      expect(response.status).toBe(201);
      expect(data.phase_name).toBe('New Phase');
    });
  });

  describe('PATCH', () => {
    it('should update phase', async () => {
      const mockUser = createMockUser({ organization_id: 'org-123' });
      const mockProject = createMockProject({ 
        owner_id: mockUser.id,
        organization_id: 'org-123',
      });
      const updatedPhase = createMockPhase({ completed: true });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockUserQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };
      // Make methods chainable
      mockUserQuery.select.mockReturnValue(mockUserQuery);
      mockUserQuery.eq.mockReturnValue(mockUserQuery);

      const mockProjectQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: mockProject.owner_id, organization_id: 'org-123' },
          error: null,
        }),
      };
      // Make methods chainable
      mockProjectQuery.select.mockReturnValue(mockProjectQuery);
      mockProjectQuery.eq.mockReturnValue(mockProjectQuery);

      // Mock project_members query (user is owner, so this can return null)
      const mockMemberQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };
      // Make methods chainable
      mockMemberQuery.select.mockReturnValue(mockMemberQuery);
      mockMemberQuery.eq.mockReturnValue(mockMemberQuery);

      // Mock update query - needs to chain: update() -> eq() -> eq() -> select() -> single()
      const mockUpdateQuery: any = {
        update: jest.fn(),
        eq: jest.fn(),
        select: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { ...updatedPhase, phase_name: 'Updated Phase Name' },
          error: null,
        }),
      };
      // Make all methods chainable - each returns the mock object
      mockUpdateQuery.update.mockReturnValue(mockUpdateQuery);
      mockUpdateQuery.eq.mockReturnValue(mockUpdateQuery);
      mockUpdateQuery.select.mockReturnValue(mockUpdateQuery);

      // Mock admin client's from() in case it's called (even though user lookup should succeed)
      const mockAdminUserQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: 'org-123', is_super_admin: false },
          error: null,
        }),
      };
      mockAdminUserQuery.select.mockReturnValue(mockAdminUserQuery);
      mockAdminUserQuery.eq.mockReturnValue(mockAdminUserQuery);
      mockAdminClient.from.mockReturnValue(mockAdminUserQuery);

      mockSupabaseClient.from
        .mockReturnValueOnce(mockUserQuery) // User lookup (should succeed, so admin client won't be called)
        .mockReturnValueOnce(mockProjectQuery) // Project lookup
        .mockReturnValueOnce(mockMemberQuery) // Member check
        .mockReturnValueOnce(mockUpdateQuery); // Phase update (with chained eq calls)

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/phases', {
        method: 'PATCH',
        body: JSON.stringify({
          phase_id: 'phase-1',
          phase_name: 'Updated Phase Name',
        }),
      });

      const response = await PATCH(request, { params: { id: 'project-1' } });
      const data = await response.json();

      if (response.status !== 200) {
        console.error('PATCH test error:', JSON.stringify(data, null, 2));
      }

      expect(response.status).toBe(200);
      expect(data.phase_name).toBe('Updated Phase Name');
    });
  });
});

