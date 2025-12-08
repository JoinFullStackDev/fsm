import type { UserRole } from '@/types/project';

/**
 * Mock data factories for testing
 */

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  auth_id: string;
  organization_id?: string;
  is_super_admin?: boolean;
  is_company_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  primary_tool: string;
  template_id: string | null;
  organization_id?: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MockPhase {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name?: string;
  phase_data?: Record<string, any>;
  data?: Record<string, any>;
  completed: boolean;
  display_order?: number;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockTask {
  id: string;
  project_id: string;
  phase_number: number;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Generate a valid UUID v4 for testing
 */
function generateTestUUID(seed: number = 1): string {
  // Generate deterministic UUIDs for testing based on seed
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const hex = seed.toString(16).padStart(8, '0');
  return `${hex}0000-0000-4000-8000-${hex}00000000`;
}

/**
 * Create a mock user
 */
export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: generateTestUUID(1), // user-1 equivalent
    email: 'test@example.com',
    name: 'Test User',
    role: 'engineer',
    auth_id: generateTestUUID(123), // auth-123 equivalent
    organization_id: 'org-123',
    is_super_admin: false,
    is_company_admin: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock project
 */
export function createMockProject(overrides?: Partial<MockProject>): MockProject {
  return {
    id: generateTestUUID(100), // project-1 equivalent
    name: 'Test Project',
    description: 'Test Description',
    status: 'in-progress',
    primary_tool: 'cursor',
    template_id: null,
    organization_id: 'org-123',
    owner_id: generateTestUUID(1), // user-1 equivalent
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock phase
 */
export function createMockPhase(overrides?: Partial<MockPhase>): MockPhase {
  return {
    id: generateTestUUID(200), // phase-1 equivalent
    project_id: generateTestUUID(100), // project-1 equivalent
    phase_number: 1,
    phase_name: 'Test Phase',
    phase_data: {},
    data: {},
    completed: false,
    display_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock task
 */
export function createMockTask(overrides?: Partial<MockTask>): MockTask {
  return {
    id: generateTestUUID(300), // task-1 equivalent
    project_id: generateTestUUID(100), // project-1 equivalent
    phase_number: 1,
    title: 'Test Task',
    description: 'Test Description',
    status: 'todo',
    assignee_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Mock Supabase query response
 */
export function createMockSupabaseResponse<T>(data: T | null, error: PostgrestError | null = null) {
  return {
    data,
    error,
    count: data ? (Array.isArray(data) ? data.length : 1) : null,
    status: error ? 400 : 200,
    statusText: error ? 'Bad Request' : 'OK',
  };
}

