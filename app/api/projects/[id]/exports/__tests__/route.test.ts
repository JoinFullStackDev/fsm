import { GET } from '../route';
import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createMockSupabaseClient } from '@/lib/test-utils';

jest.mock('@/lib/supabaseServer');
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
    })),
  },
}));

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<
  typeof createServerSupabaseClient
>;

describe('GET /api/projects/[id]/exports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return unauthorized if no session', async () => {
    const mockSupabase = createMockSupabaseClient();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockCreateServerSupabaseClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost:3000/api/projects/123/exports');
    const response = await GET(request, { params: { id: '123' } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('logged in');
  });

  it('should return not found if project does not exist', async () => {
    const mockSupabase = createMockSupabaseClient();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } as any },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123' },
            error: null,
          }),
        } as any;
      }
      if (table === 'projects') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        } as any;
      }
      return {} as any;
    });

    mockCreateServerSupabaseClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost:3000/api/projects/123/exports');
    const response = await GET(request, { params: { id: '123' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('should return forbidden if user is not owner or member', async () => {
    const mockSupabase = createMockSupabaseClient();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } as any },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-123' },
            error: null,
          }),
        } as any;
      }
      if (table === 'projects') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: '123', owner_id: 'other-user' },
            error: null,
          }),
        } as any;
      }
      if (table === 'project_members') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    mockCreateServerSupabaseClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost:3000/api/projects/123/exports');
    const response = await GET(request, { params: { id: '123' } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('access');
  });

  it('should return exports list with pagination', async () => {
    const mockSupabase = createMockSupabaseClient();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } as any },
      error: null,
    });

    const mockExports = [
      {
        id: 'exp-1',
        project_id: '123',
        export_type: 'blueprint_bundle',
        storage_path: null,
        user_id: 'user-123',
        file_size: 1024,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'exp-2',
        project_id: '123',
        export_type: 'cursor_bundle',
        storage_path: null,
        user_id: 'user-123',
        file_size: 2048,
        created_at: '2024-01-02T00:00:00Z',
      },
    ];

    let exportsCallCount = 0;
    let usersCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        usersCallCount++;
        if (usersCallCount === 1) {
          // First call: get user by auth_id
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123' },
              error: null,
            }),
          } as any;
        } else {
          // Second call: get users by ids (for user data in exports)
          const usersQuery: any = {
            select: jest.fn().mockReturnThis(),
            in: jest.fn(),
          };
          usersQuery.select.mockReturnValue(usersQuery);
          usersQuery.in.mockResolvedValue({
            data: [{ id: 'user-123', name: 'Test User', email: 'test@example.com' }],
            error: null,
          });
          return usersQuery;
        }
      }
      if (table === 'projects') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: '123', owner_id: 'user-123' },
            error: null,
          }),
        } as any;
      }
      if (table === 'exports') {
        exportsCallCount++;
        const isFirstCall = exportsCallCount === 1;
        
        const result = isFirstCall
          ? Promise.reject(new Error('Join failed'))
          : Promise.resolve({
              data: mockExports,
              error: null,
              count: 2,
            });
        
        const builder: any = {
          select: jest.fn(),
          eq: jest.fn(),
          order: jest.fn(),
          range: jest.fn(),
          gte: jest.fn(),
          lt: jest.fn(),
        };
        
        // All methods return the builder for chaining
        builder.select.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.range.mockReturnValue(builder);
        builder.gte.mockReturnValue(builder);
        builder.lt.mockReturnValue(builder);
        
        // Make builder thenable by binding promise methods
        builder.then = result.then.bind(result);
        builder.catch = result.catch.bind(result);
        builder.finally = result.finally?.bind(result);
        
        return builder;
      }
      return {} as any;
    });

    mockCreateServerSupabaseClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost:3000/api/projects/123/exports?limit=20&offset=0');
    const response = await GET(request, { params: { id: '123' } });
    const data = await response.json();

    if (response.status !== 200) {
      console.error('Error response:', data);
    }

    expect(response.status).toBe(200);
    expect(data.exports).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.limit).toBe(20);
    expect(data.offset).toBe(0);
  });

  it('should filter by export type', async () => {
    const mockSupabase = createMockSupabaseClient();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } as any },
      error: null,
    });

    const mockEq = jest.fn();
    let exportsCallCount = 0;
    let usersCallCount = 0;
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        usersCallCount++;
        if (usersCallCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-123' },
              error: null,
            }),
          } as any;
        } else {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          } as any;
        }
      }
      if (table === 'projects') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: '123', owner_id: 'user-123' },
            error: null,
          }),
        } as any;
      }
      if (table === 'exports') {
        exportsCallCount++;
        const isFirstCall = exportsCallCount === 1;
        
        const result = isFirstCall
          ? Promise.reject(new Error('Join failed'))
          : Promise.resolve({
              data: [],
              error: null,
              count: 0,
            });
        
        const builder: any = {
          select: jest.fn(),
          eq: jest.fn((...args) => {
            mockEq(...args); // Track the call
            return builder; // Return builder for chaining
          }),
          order: jest.fn(),
          range: jest.fn(),
          gte: jest.fn(),
          lt: jest.fn(),
        };
        
        // All methods return the builder for chaining
        builder.select.mockReturnValue(builder);
        builder.order.mockReturnValue(builder);
        builder.range.mockReturnValue(builder);
        builder.gte.mockReturnValue(builder);
        builder.lt.mockReturnValue(builder);
        
        // Make builder thenable by binding promise methods
        builder.then = result.then.bind(result);
        builder.catch = result.catch.bind(result);
        builder.finally = result.finally?.bind(result);
        
        return builder;
      }
      return {} as any;
    });

    mockCreateServerSupabaseClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost:3000/api/projects/123/exports?export_type=blueprint_bundle');
    await GET(request, { params: { id: '123' } });

    // Verify eq was called with export_type (should be called twice - once for join query, once for fallback)
    expect(mockEq).toHaveBeenCalledWith('export_type', 'blueprint_bundle');
  });
});

