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
import { POST } from '../route';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createMockUser } from '@/lib/test-helpers';

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

describe('/api/requests', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  const mockUser = createMockUser({
    id: 'user-123',
    organization_id: 'org-123',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('POST', () => {
    it('should create a feature request successfully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, organization_id: mockUser.organization_id },
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'request-123',
            type: 'feature',
            title: 'Test Feature',
            description: 'Test Description',
            priority: 'medium',
            status: 'open',
            user_id: mockUser.id,
            organization_id: mockUser.organization_id,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') return mockUserQuery;
        if (table === 'feature_bug_requests') return mockInsertQuery;
        return {};
      });

      const request = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'feature',
          title: 'Test Feature',
          description: 'Test Description',
          priority: 'medium',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.type).toBe('feature');
      expect(data.title).toBe('Test Feature');
      expect(mockInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'feature',
          title: 'Test Feature',
          description: 'Test Description',
          priority: 'medium',
          user_id: mockUser.id,
          organization_id: mockUser.organization_id,
          status: 'open',
        })
      );
    });

    it('should create a bug report with all required fields', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, organization_id: mockUser.organization_id },
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'request-456',
            type: 'bug',
            title: 'Test Bug',
            description: 'Test Bug Description',
            priority: 'high',
            status: 'open',
            page_url: 'http://localhost/test',
            steps_to_reproduce: 'Step 1',
            expected_behavior: 'Should work',
            actual_behavior: 'Does not work',
            user_id: mockUser.id,
            organization_id: mockUser.organization_id,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') return mockUserQuery;
        if (table === 'feature_bug_requests') return mockInsertQuery;
        return {};
      });

      const request = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'bug',
          title: 'Test Bug',
          description: 'Test Bug Description',
          priority: 'high',
          page_url: 'http://localhost/test',
          steps_to_reproduce: 'Step 1',
          expected_behavior: 'Should work',
          actual_behavior: 'Does not work',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.type).toBe('bug');
      expect(data.steps_to_reproduce).toBe('Step 1');
      expect(mockInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bug',
          page_url: 'http://localhost/test',
          steps_to_reproduce: 'Step 1',
          expected_behavior: 'Should work',
          actual_behavior: 'Does not work',
        })
      );
    });

    it('should return 401 if user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'feature',
          title: 'Test',
          description: 'Test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('logged in');
    });

    it('should return 400 if required fields are missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, organization_id: mockUser.organization_id },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockUserQuery);

      const request = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'feature',
          // Missing title and description
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 400 if bug report is missing required fields', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, organization_id: mockUser.organization_id },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockUserQuery);

      const request = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'bug',
          title: 'Test Bug',
          description: 'Test Description',
          // Missing steps_to_reproduce, expected_behavior, actual_behavior
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('steps_to_reproduce');
    });

    it('should return 400 if invalid type is provided', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, organization_id: mockUser.organization_id },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockUserQuery);

      const request = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'invalid',
          title: 'Test',
          description: 'Test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('feature');
    });

    it('should default priority to medium if not provided', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, organization_id: mockUser.organization_id },
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'request-789',
            type: 'feature',
            title: 'Test',
            description: 'Test',
            priority: 'medium',
            status: 'open',
            user_id: mockUser.id,
            organization_id: mockUser.organization_id,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') return mockUserQuery;
        if (table === 'feature_bug_requests') return mockInsertQuery;
        return {};
      });

      const request = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'feature',
          title: 'Test',
          description: 'Test',
          // No priority provided
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(mockInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'medium',
        })
      );
    });

    it('should trim whitespace from text fields', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
        error: null,
      });

      const mockUserQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUser.id, organization_id: mockUser.organization_id },
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'request-trim',
            type: 'feature',
            title: 'Test Feature',
            description: 'Test Description',
            priority: 'medium',
            status: 'open',
            user_id: mockUser.id,
            organization_id: mockUser.organization_id,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') return mockUserQuery;
        if (table === 'feature_bug_requests') return mockInsertQuery;
        return {};
      });

      const request = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'feature',
          title: '  Test Feature  ',
          description: '  Test Description  ',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(mockInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Feature',
          description: 'Test Description',
        })
      );
    });
  });
});

