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

// Helper to generate test UUIDs
function generateTestUUID(seed: number = 1): string {
  const hex = seed.toString(16).padStart(8, '0');
  return `${hex}0000-0000-4000-8000-${hex}00000000`;
}

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

// Helper to create chainable query mocks
function createChainableQuery(methods: string[], finalMethod: string, finalValue: any) {
  const query: any = {};
  
  // Create all chainable methods first
  methods.forEach(method => {
    query[method] = jest.fn();
  });
  
  // Create final method that returns a promise
  query[finalMethod] = jest.fn().mockResolvedValue(finalValue);
  
  // Make all chainable methods return the query object itself
  // This allows chaining: query.select().eq().order().limit()
  methods.forEach(method => {
    query[method].mockImplementation(() => query);
  });
  
  return query;
}

describe('/api/projects/[id]/phases', () => {
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
    // Reset from() mock to ensure clean state
    mockSupabaseClient.from.mockReset();
    mockAdminClient.from.mockReset();
    mockSupabaseClient.auth.getUser.mockReset();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    (createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdminClient);
    (getUserOrganizationId as jest.Mock).mockResolvedValue(validOrgId);
  });

  describe('GET', () => {
    it('should return phases for project', async () => {
      const mockUser = createMockUser({ organization_id: validOrgId });
      const mockProject = createMockProject({ 
        owner_id: mockUser.id,
        organization_id: validOrgId,
      });
      const mockPhases = [
        createMockPhase({ phase_number: 1, project_id: mockProject.id }),
        createMockPhase({ phase_number: 2, project_id: mockProject.id }),
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
          data: { owner_id: mockProject.owner_id, organization_id: validOrgId },
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}/phases`);
      const response = await GET(request, { params: { id: mockProject.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phases).toEqual(mockPhases);
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}/phases`);
      const response = await GET(request, { params: { id: mockProject.id } });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user is not owner or member', async () => {
      const otherUser = createMockUser({ id: generateTestUUID(2), organization_id: validOrgId });
      const mockUser = createMockUser({ organization_id: validOrgId });
      const mockProject = createMockProject({ owner_id: otherUser.id, organization_id: generateTestUUID(456) });

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
          data: { owner_id: mockProject.owner_id, organization_id: mockProject.organization_id },
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}/phases`);
      const response = await GET(request, { params: { id: mockProject.id } });

      expect(response.status).toBe(403);
    });
  });

  describe('POST', () => {
    it('should create phase when user is owner', async () => {
      const mockUser = createMockUser({ organization_id: validOrgId });
      const mockProject = createMockProject({ 
        owner_id: mockUser.id,
        organization_id: validOrgId,
      });
      const newPhase = createMockPhase({ phase_number: 3 });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id },
        },
        error: null,
      });

      const mockUserQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: validOrgId, is_super_admin: false },
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
          data: { owner_id: mockProject.owner_id, organization_id: validOrgId },
          error: null,
        }),
      };
      // Make methods chainable
      mockProjectQuery.select.mockReturnValue(mockProjectQuery);
      mockProjectQuery.eq.mockReturnValue(mockProjectQuery);

      // Mock project_members query (user is owner, so this can return null)
      // Chain: select() -> eq() -> eq() -> single()
      // The route uses .single() which returns error when not found
      // But the route destructures { data: projectMember }, so projectMember will be null
      // Since isOwner is true, isProjectMember will be true regardless
      const mockMemberQuery: any = {};
      mockMemberQuery.select = jest.fn().mockImplementation(() => mockMemberQuery);
      mockMemberQuery.eq = jest.fn().mockImplementation(() => mockMemberQuery); // Called twice but returns itself
      mockMemberQuery.single = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      // Mock existing phases query - chain: select() -> eq() -> order() -> limit()
      // The route does: .select('phase_number, display_order').eq('project_id', params.id).order('phase_number', { ascending: false }).limit(1)
      const mockExistingPhasesQuery: any = {};
      mockExistingPhasesQuery.select = jest.fn().mockImplementation(() => mockExistingPhasesQuery);
      mockExistingPhasesQuery.eq = jest.fn().mockImplementation(() => mockExistingPhasesQuery);
      mockExistingPhasesQuery.order = jest.fn().mockImplementation(() => mockExistingPhasesQuery);
      mockExistingPhasesQuery.limit = jest.fn().mockResolvedValue({ data: [], error: null });

      const mockInsertQuery: any = {};
      mockInsertQuery.insert = jest.fn().mockImplementation(() => mockInsertQuery);
      mockInsertQuery.select = jest.fn().mockImplementation(() => mockInsertQuery);
      mockInsertQuery.single = jest.fn().mockResolvedValue({
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
      });

      // Mock admin client's from() in case it's called (even though user lookup should succeed)
      const mockAdminUserQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: validOrgId, is_super_admin: false },
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}/phases`, {
        method: 'POST',
        body: JSON.stringify({
          phase_name: 'New Phase',
        }),
      });

      const response = await POST(request, { params: { id: mockProject.id } });
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
      const mockUser = createMockUser({ organization_id: validOrgId });
      const mockProject = createMockProject({ 
        owner_id: mockUser.id,
        organization_id: validOrgId,
      });
      const updatedPhase = createMockPhase({ completed: true });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: { id: mockUser.auth_id },
        },
        error: null,
      });

      const mockUserQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: validOrgId, is_super_admin: false },
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
          data: { owner_id: mockProject.owner_id, organization_id: validOrgId },
          error: null,
        }),
      };
      // Make methods chainable
      mockProjectQuery.select.mockReturnValue(mockProjectQuery);
      mockProjectQuery.eq.mockReturnValue(mockProjectQuery);

      // Mock project_members query (user is owner, so this can return null)
      // Chain: select() -> eq() -> eq() -> single()
      const mockMemberQuery: any = {};
      mockMemberQuery.select = jest.fn().mockImplementation(() => mockMemberQuery);
      mockMemberQuery.eq = jest.fn().mockImplementation(() => mockMemberQuery); // Called twice but returns itself
      mockMemberQuery.single = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      // Mock update query - needs to chain: update() -> eq() -> eq() -> select() -> single()
      // The route does: .update(updateData).eq('id', phase_id).eq('project_id', params.id).select().single()
      const mockUpdateQuery: any = {};
      mockUpdateQuery.update = jest.fn().mockImplementation(() => mockUpdateQuery);
      mockUpdateQuery.eq = jest.fn().mockImplementation(() => mockUpdateQuery); // Called twice but returns itself
      mockUpdateQuery.select = jest.fn().mockImplementation(() => mockUpdateQuery);
      mockUpdateQuery.single = jest.fn().mockResolvedValue({
        data: { ...updatedPhase, phase_name: 'Updated Phase Name' },
        error: null,
      });

      // Mock admin client's from() in case it's called (even though user lookup should succeed)
      const mockAdminUserQuery: any = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role, organization_id: validOrgId, is_super_admin: false },
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

      const request = new NextRequest(`http://localhost:3000/api/projects/${mockProject.id}/phases`, {
        method: 'PATCH',
        body: JSON.stringify({
          phase_id: 'phase-1',
          phase_name: 'Updated Phase Name',
        }),
      });

      const response = await PATCH(request, { params: { id: mockProject.id } });
      const data = await response.json();

      if (response.status !== 200) {
        console.error('PATCH test error:', JSON.stringify(data, null, 2));
      }

      expect(response.status).toBe(200);
      expect(data.phase_name).toBe('Updated Phase Name');
    });
  });
});

