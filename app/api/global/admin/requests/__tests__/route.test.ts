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
import { GET, PATCH } from '../route';
import { requireSuperAdmin } from '@/lib/globalAdmin';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';

jest.mock('@/lib/globalAdmin');
jest.mock('@/lib/supabaseAdmin');
jest.mock('@/lib/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('/api/global/admin/requests', () => {
  const mockAdminClient = {
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireSuperAdmin as jest.Mock).mockResolvedValue({ userId: 'super-admin-123' });
    (createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdminClient);
  });

  describe('GET', () => {
    it('should return all requests for super admin', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          type: 'feature',
          title: 'Test Feature',
          description: 'Test',
          status: 'open',
          priority: 'medium',
          user: { id: 'user-1', name: 'User 1', email: 'user1@test.com' },
          created_at: new Date().toISOString(),
        },
        {
          id: 'request-2',
          type: 'bug',
          title: 'Test Bug',
          description: 'Test',
          status: 'open',
          priority: 'high',
          user: { id: 'user-2', name: 'User 2', email: 'user2@test.com' },
          created_at: new Date().toISOString(),
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockRequests,
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requests).toHaveLength(2);
      expect(data.requests[0].type).toBe('feature');
      expect(data.requests[1].type).toBe('bug');
    });

    it('should filter by type when provided', async () => {
      const finalQuery = Promise.resolve({
        data: [{ id: 'request-1', type: 'feature' }],
        error: null,
      });
      
      const mockRangeQuery = {
        range: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(finalQuery),
        }),
      };
      const mockOrderQuery = {
        order: jest.fn().mockReturnValue(mockRangeQuery),
      };
      const mockSelectQuery = {
        select: jest.fn().mockReturnValue(mockOrderQuery),
      };

      mockAdminClient.from.mockReturnValue(mockSelectQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests?type=feature');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockRangeQuery.range().eq).toHaveBeenCalledWith('type', 'feature');
    });

    it('should filter by status when provided', async () => {
      const finalQuery = Promise.resolve({
        data: [{ id: 'request-1', status: 'resolved' }],
        error: null,
      });
      
      const mockRangeQuery = {
        range: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(finalQuery),
        }),
      };
      const mockOrderQuery = {
        order: jest.fn().mockReturnValue(mockRangeQuery),
      };
      const mockSelectQuery = {
        select: jest.fn().mockReturnValue(mockOrderQuery),
      };

      mockAdminClient.from.mockReturnValue(mockSelectQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests?status=resolved');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockRangeQuery.range().eq).toHaveBeenCalledWith('status', 'resolved');
    });

    it('should apply both type and status filters', async () => {
      const finalQuery = Promise.resolve({
        data: [{ id: 'request-1', type: 'bug', status: 'open' }],
        error: null,
      });
      
      const mockAfterFirstEq = {
        eq: jest.fn().mockReturnValue(finalQuery),
      };
      const mockRangeQuery = {
        range: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(mockAfterFirstEq),
        }),
      };
      const mockOrderQuery = {
        order: jest.fn().mockReturnValue(mockRangeQuery),
      };
      const mockSelectQuery = {
        select: jest.fn().mockReturnValue(mockOrderQuery),
      };

      mockAdminClient.from.mockReturnValue(mockSelectQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests?type=bug&status=open');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockRangeQuery.range().eq).toHaveBeenCalledWith('type', 'bug');
      expect(mockAfterFirstEq.eq).toHaveBeenCalledWith('status', 'open');
    });

    it('should handle pagination with limit and offset', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests?limit=50&offset=10');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      expect(mockQuery.range).toHaveBeenCalledWith(10, 59); // offset, offset + limit - 1
    });

    it('should return 403 if user is not super admin', async () => {
      const errorResponse = {
        status: 403,
        json: () => Promise.resolve({ error: 'Super admin access required' }),
      };
      (requireSuperAdmin as jest.Mock).mockRejectedValue(errorResponse);

      const request = new NextRequest('http://localhost/api/global/admin/requests');
      const response = await GET(request);
      
      expect(response.status).toBe(403);
    });

    it('should handle database errors gracefully', async () => {
      const mockRangeQuery = {
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };
      const mockOrderQuery = {
        order: jest.fn().mockReturnValue(mockRangeQuery),
      };
      const mockSelectQuery = {
        select: jest.fn().mockReturnValue(mockOrderQuery),
      };

      mockAdminClient.from.mockReturnValue(mockSelectQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('An internal error occurred');
    });
  });

  describe('PATCH', () => {
    it('should update request status successfully', async () => {
      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'request-1',
            type: 'feature',
            title: 'Test',
            status: 'in_progress',
            priority: 'high',
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockUpdateQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'request-1',
          status: 'in_progress',
          priority: 'high',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('in_progress');
      expect(mockUpdateQuery.update).toHaveBeenCalled();
      expect(mockUpdateQuery.eq).toHaveBeenCalledWith('id', 'request-1');
    });

    it('should set resolved_at and resolved_by when status is resolved', async () => {
      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'request-1',
            status: 'resolved',
            resolved_at: expect.any(String),
            resolved_by: 'super-admin-123',
          },
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockUpdateQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'request-1',
          status: 'resolved',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('resolved');
      expect(mockUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
          resolved_at: expect.any(String),
          resolved_by: 'super-admin-123',
        })
      );
    });

    it('should clear resolved fields when changing from resolved to another status', async () => {
      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'request-1',
            status: 'open',
            resolved_at: null,
            resolved_by: null,
          },
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockUpdateQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'request-1',
          status: 'open',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'open',
          resolved_at: null,
          resolved_by: null,
        })
      );
    });

    it('should update assigned_to field', async () => {
      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'request-1',
            assigned_to: 'user-456',
          },
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockUpdateQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'request-1',
          assigned_to: 'user-456',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          assigned_to: 'user-456',
        })
      );
    });

    it('should update resolution_notes field', async () => {
      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'request-1',
            resolution_notes: 'Fixed in v1.2.3',
          },
          error: null,
        }),
      };

      mockAdminClient.from.mockReturnValue(mockUpdateQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'request-1',
          resolution_notes: 'Fixed in v1.2.3',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution_notes: 'Fixed in v1.2.3',
        })
      );
    });

    it('should return 400 if request ID is missing', async () => {
      const request = new NextRequest('http://localhost/api/global/admin/requests', {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'open',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('ID is required');
    });

    it('should return 400 if invalid status is provided', async () => {
      const request = new NextRequest('http://localhost/api/global/admin/requests', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'request-1',
          status: 'invalid_status',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Status must be one of');
    });

    it('should return 400 if invalid priority is provided', async () => {
      const request = new NextRequest('http://localhost/api/global/admin/requests', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'request-1',
          priority: 'invalid_priority',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Priority must be one of');
    });

    it('should handle database errors gracefully', async () => {
      const mockSingleQuery = {
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };
      const mockSelectQuery = {
        select: jest.fn().mockReturnValue(mockSingleQuery),
      };
      const mockEqQuery = {
        eq: jest.fn().mockReturnValue(mockSelectQuery),
      };
      const mockUpdateQuery = {
        update: jest.fn().mockReturnValue(mockEqQuery),
      };

      mockAdminClient.from.mockReturnValue(mockUpdateQuery);

      const request = new NextRequest('http://localhost/api/global/admin/requests', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'request-1',
          status: 'open',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('An internal error occurred');
    });
  });
});

