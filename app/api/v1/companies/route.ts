import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/apiKeyAuth';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, forbidden, internalError } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/companies
 * List companies (API key auth)
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

    // Enforce scope - org-scoped keys can only see their org's companies
    const adminClient = createAdminSupabaseClient();
    let query = adminClient
      .from('companies')
      .select('id, name, website, industry, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply organization filter for org-scoped keys
    if (apiKeyContext.scope === 'org' && apiKeyContext.organizationId) {
      query = query.eq('organization_id', apiKeyContext.organizationId);
    }
    // Global-scoped keys can see all companies

    // Get pagination params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    query = query.range(offset, offset + limit - 1);

    const { data: companies, error, count } = await query;

    if (error) {
      logger.error('[API v1] Error fetching companies:', error);
      return internalError('Failed to fetch companies');
    }

    return NextResponse.json({
      data: companies || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as NextResponse; // Already a NextResponse error
    }
    logger.error('[API v1] Unexpected error:', error);
    return internalError('Failed to fetch companies');
  }
}

/**
 * POST /api/v1/companies
 * Create company (requires write permission, org-scoped only)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate API key
    const apiKeyContext = await requireApiKeyAuth(request);

    // Check write permission
    if (apiKeyContext.permissions !== 'write') {
      return forbidden('Write permission required');
    }

    // Org-scoped keys only
    if (apiKeyContext.scope !== 'org' || !apiKeyContext.organizationId) {
      return forbidden('Company creation requires org-scoped API key');
    }

    const body = await request.json();
    const { name, website, industry } = body;

    if (!name) {
      return unauthorized('name is required');
    }

    const adminClient = createAdminSupabaseClient();
    const { data: company, error } = await adminClient
      .from('companies')
      .insert({
        name,
        website: website || null,
        industry: industry || null,
        organization_id: apiKeyContext.organizationId,
      })
      .select('id, name, website, industry, created_at, updated_at')
      .single();

    if (error || !company) {
      logger.error('[API v1] Error creating company:', error);
      return internalError('Failed to create company');
    }

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as NextResponse; // Already a NextResponse error
    }
    logger.error('[API v1] Unexpected error:', error);
    return internalError('Failed to create company');
  }
}

