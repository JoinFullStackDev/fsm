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
import { createMockUser, createMockProject, createMockPhase } from '@/lib/test-helpers';

jest.mock('@/lib/supabaseServer');
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

  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET', () => {
    it('should return phases for project', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject({ owner_id: mockUser.id });
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

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProject,
          error: null,
        }),
      };

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockUser,
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
        .mockReturnValueOnce(mockProjectQuery)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockPhasesQuery);

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
      const mockUser = createMockUser({ id: 'user-2' });
      const mockProject = createMockProject({ owner_id: 'user-1' });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProject,
          error: null,
        }),
      };

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockUser,
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
        .mockReturnValueOnce(mockProjectQuery)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockMemberQuery);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/phases');
      const response = await GET(request, { params: { id: 'project-1' } });

      expect(response.status).toBe(403);
    });
  });

  describe('POST', () => {
    it('should create phase when user is owner', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject({ owner_id: mockUser.id });
      const newPhase = createMockPhase({ phase_number: 3 });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: mockProject.owner_id },
          error: null,
        }),
      };

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role },
          error: null,
        }),
      };

      const mockExistingPhasesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...newPhase, phase_name: 'New Phase' },
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockProjectQuery)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockExistingPhasesQuery)
        .mockReturnValueOnce(mockInsertQuery);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/phases', {
        method: 'POST',
        body: JSON.stringify({
          phase_name: 'New Phase',
        }),
      });

      const response = await POST(request, { params: { id: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.phase_name).toBe('New Phase');
    });
  });

  describe('PATCH', () => {
    it('should update phase', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject({ owner_id: mockUser.id });
      const updatedPhase = createMockPhase({ completed: true });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'auth-123' },
          },
        },
      });

      const mockProjectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { owner_id: mockProject.owner_id },
          error: null,
        }),
      };

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, role: mockUser.role },
          error: null,
        }),
      };

      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...updatedPhase, phase_name: 'Updated Phase Name' },
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockProjectQuery)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockUpdateQuery);

      const request = new NextRequest('http://localhost:3000/api/projects/project-1/phases', {
        method: 'PATCH',
        body: JSON.stringify({
          phase_id: 'phase-1',
          phase_name: 'Updated Phase Name',
        }),
      });

      const response = await PATCH(request, { params: { id: 'project-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phase_name).toBe('Updated Phase Name');
    });
  });
});

