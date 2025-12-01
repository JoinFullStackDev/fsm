import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/apiKeyAuth';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, forbidden, internalError } from '@/lib/utils/apiErrors';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimit';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/opportunities
 * List opportunities (API key auth)
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

    // Enforce scope - org-scoped keys can only see their org's opportunities
    const adminClient = createAdminSupabaseClient();
    let query = adminClient
      .from('opportunities')
      .select('id, name, value, status, source, company_id, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply organization filter for org-scoped keys
    if (apiKeyContext.scope === 'org' && apiKeyContext.organizationId) {
      query = query.eq('organization_id', apiKeyContext.organizationId);
    }
    // Global-scoped keys can see all opportunities

    // Get pagination params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    query = query.range(offset, offset + limit - 1);

    const { data: opportunities, error, count } = await query;

    if (error) {
      logger.error('[API v1] Error fetching opportunities:', error);
      return internalError('Failed to fetch opportunities');
    }

    return NextResponse.json({
      data: opportunities || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    if (error.status) {
      return error; // Already a NextResponse error
    }
    logger.error('[API v1] Unexpected error:', error);
    return internalError('Failed to fetch opportunities');
  }
}

/**
 * POST /api/v1/opportunities
 * Create opportunity (requires write permission, org-scoped only)
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
      return forbidden('Opportunity creation requires org-scoped API key');
    }

    const body = await request.json();
    const { name, value, status, source, company_id } = body;

    if (!name) {
      return unauthorized('name is required');
    }

    // Verify company belongs to the same organization
    if (company_id) {
      const adminClient = createAdminSupabaseClient();
      const { data: company, error: companyError } = await adminClient
        .from('companies')
        .select('id, organization_id')
        .eq('id', company_id)
        .single();

      if (companyError || !company) {
        return unauthorized('Company not found');
      }

      if (company.organization_id !== apiKeyContext.organizationId) {
        return forbidden('Company does not belong to your organization');
      }
    }

    const adminClient = createAdminSupabaseClient();
    const { data: opportunity, error } = await adminClient
      .from('opportunities')
      .insert({
        name,
        value: value ? parseFloat(value) : null,
        status: status || 'new',
        source: source || 'Manual',
        company_id: company_id || null,
        organization_id: apiKeyContext.organizationId,
      })
      .select('id, name, value, status, source, company_id, created_at, updated_at')
      .single();

    if (error || !opportunity) {
      logger.error('[API v1] Error creating opportunity:', error);
      return internalError('Failed to create opportunity');
    }

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return error; // Already a NextResponse error
    }
    logger.error('[API v1] Unexpected error:', error);
    return internalError('Failed to create opportunity');
  }
}

