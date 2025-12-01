import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/apiKeyAuth';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, forbidden, internalError } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/projects
 * List projects (API key auth)
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for API key endpoints
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.apiKey);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authenticate API key
    const apiKeyContext = await requireApiKeyAuth(request);

    // Enforce scope - org-scoped keys can only see their org's projects
    const adminClient = createAdminSupabaseClient();
    let query = adminClient
      .from('projects')
      .select('id, name, description, status, company_id, owner_id, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply organization filter for org-scoped keys
    if (apiKeyContext.scope === 'org' && apiKeyContext.organizationId) {
      query = query.eq('organization_id', apiKeyContext.organizationId);
    }
    // Global-scoped keys can see all projects

    // Get pagination params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    query = query.range(offset, offset + limit - 1);

    const { data: projects, error, count } = await query;

    if (error) {
      logger.error('[API v1] Error fetching projects:', error);
      return internalError('Failed to fetch projects');
    }

    return NextResponse.json({
      data: projects || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    if (error.status) {
      return error; // Already a NextResponse error
    }
    logger.error('[API v1] Unexpected error:', error);
    return internalError('Failed to fetch projects');
  }
}

/**
 * POST /api/v1/projects
 * Create project (API key auth, requires write permission)
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for API key endpoints
    const rateLimitResponse = checkRateLimit(request, RATE_LIMIT_CONFIGS.apiKey);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authenticate API key
    const apiKeyContext = await requireApiKeyAuth(request);

    // Check write permission
    if (apiKeyContext.permissions !== 'write') {
      return forbidden('Write permission required');
    }

    // Org-scoped keys can only create projects for their org
    const body = await request.json();
    const { name, description, company_id, organization_id } = body;

    if (!name) {
      return unauthorized('name is required');
    }

    // Validate organization_id matches key's scope
    if (apiKeyContext.scope === 'org') {
      if (!apiKeyContext.organizationId) {
        return forbidden('Organization-scoped key must have organization_id');
      }
      if (organization_id && organization_id !== apiKeyContext.organizationId) {
        return forbidden('Cannot create project for different organization');
      }
    }

    const adminClient = createAdminSupabaseClient();
    const { data: project, error } = await adminClient
      .from('projects')
      .insert({
        name,
        description: description || null,
        company_id: company_id || null,
        organization_id: apiKeyContext.scope === 'org' ? apiKeyContext.organizationId : organization_id || null,
        owner_id: null, // API keys don't have a user owner
        status: 'active',
      })
      .select('id, name, description, status, company_id, owner_id, created_at, updated_at')
      .single();

    if (error || !project) {
      logger.error('[API v1] Error creating project:', error);
      return internalError('Failed to create project');
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return error; // Already a NextResponse error
    }
    logger.error('[API v1] Unexpected error:', error);
    return internalError('Failed to create project');
  }
}

