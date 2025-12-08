/**
 * Query batching utilities
 * Provides functions to batch multiple database queries into single requests
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type { ProjectPhaseRow, ProjectMemberRow } from '@/types/database';

export interface BatchQueryResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface BatchQueryRequest {
  type: string;
  params: Record<string, unknown>;
}

// Type for the admin Supabase client
type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

/**
 * Execute batched queries
 * Combines multiple queries into a single request to reduce round trips
 */
export async function executeBatchQueries(
  queries: BatchQueryRequest[]
): Promise<Record<string, BatchQueryResult>> {
  const results: Record<string, BatchQueryResult> = {};
  const adminClient = createAdminSupabaseClient();

  // Group queries by type for potential optimization
  const queriesByType = new Map<string, BatchQueryRequest[]>();
  queries.forEach((query, index) => {
    const key = `${query.type}_${index}`;
    if (!queriesByType.has(query.type)) {
      queriesByType.set(query.type, []);
    }
    queriesByType.get(query.type)!.push(query);
  });

  // Execute queries in parallel where possible
  const promises = queries.map(async (query, index) => {
    const key = `${query.type}_${index}`;
    try {
      const result = await executeQuery(adminClient, query);
      results[key] = { success: true, data: result };
    } catch (error) {
      logger.error(`[BatchQueries] Error executing query ${key}:`, error);
      results[key] = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Execute a single query based on type
 */
async function executeQuery(
  adminClient: AdminClient,
  query: BatchQueryRequest
): Promise<unknown> {
  switch (query.type) {
    case 'project_phases':
      return await adminClient
        .from('project_phases')
        .select('*')
        .eq('project_id', query.params.projectId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    case 'project_members':
      return await adminClient
        .from('project_members')
        .select(`
          id,
          user_id,
          role,
          user:users!project_members_user_id_fkey (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .eq('project_id', query.params.projectId)
        .order('created_at', { ascending: true });

    case 'role_permissions':
      return await adminClient
        .from('role_permissions')
        .select('permission')
        .eq('role_id', query.params.roleId);

    case 'user_projects':
      return await adminClient
        .from('project_members')
        .select('project_id')
        .eq('user_id', query.params.userId);

    case 'project':
      return await adminClient
        .from('projects')
        .select('*')
        .eq('id', query.params.projectId)
        .single();

    default:
      throw new Error(`Unknown query type: ${query.type}`);
  }
}

// Member query result type
interface MemberQueryResult extends Pick<ProjectMemberRow, 'id' | 'user_id' | 'role'> {
  user: Array<{ id: string; name: string | null; email: string; avatar_url: string | null }> | null;
}

/**
 * Batch project data queries (phases + members)
 */
export async function batchProjectData(projectId: string): Promise<{
  phases: ProjectPhaseRow[];
  members: MemberQueryResult[];
}> {
  const adminClient = createAdminSupabaseClient();

  const [phasesResult, membersResult] = await Promise.all([
    adminClient
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    adminClient
      .from('project_members')
      .select(`
        id,
        user_id,
        role,
        user:users!project_members_user_id_fkey (
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
  ]);

  return {
    phases: phasesResult.data || [],
    members: membersResult.data || [],
  };
}

