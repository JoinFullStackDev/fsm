import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, notFound, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasOpsTool } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ops/partners/[id]/stats
 * Returns detailed statistics for a specific partner company
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: partnerId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view partner stats');
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Check if organization has ops tool access
    const hasAccess = await hasOpsTool(supabase, organizationId);
    if (!hasAccess) {
      return forbidden('Ops Tool is not available for your subscription plan');
    }

    const adminClient = createAdminSupabaseClient();

    // Verify partner exists and belongs to organization
    const { data: partner, error: partnerError } = await adminClient
      .from('companies')
      .select('id, name, is_partner, partner_commission_rate')
      .eq('id', partnerId)
      .eq('organization_id', organizationId)
      .single();

    if (partnerError || !partner) {
      return notFound('Partner company');
    }

    if (!partner.is_partner) {
      return badRequest('Company is not marked as a partner');
    }

    // Get referred companies
    const { data: referredCompanies, error: refCompError } = await adminClient
      .from('companies')
      .select('id, name, status, created_at')
      .eq('organization_id', organizationId)
      .eq('referred_by_company_id', partnerId)
      .order('created_at', { ascending: false });

    if (refCompError) {
      logger.error('Error loading referred companies:', refCompError);
    }

    // Get referred opportunities with company info
    const { data: referredOpportunities, error: refOppError } = await adminClient
      .from('opportunities')
      .select(`
        id, name, value, status, created_at,
        company:companies!opportunities_company_id_fkey (id, name)
      `)
      .eq('organization_id', organizationId)
      .eq('referred_by_company_id', partnerId)
      .order('created_at', { ascending: false });

    if (refOppError) {
      logger.error('Error loading referred opportunities:', refOppError);
    }

    // Get projects from referred companies
    const referredCompanyIds = (referredCompanies || []).map(c => c.id);
    let referredProjects: Array<{
      id: string;
      name: string;
      status: string;
      created_at: string;
      company?: { id: string; name: string } | null;
    }> = [];
    
    if (referredCompanyIds.length > 0) {
      const { data: projects, error: projectsError } = await adminClient
        .from('projects')
        .select(`
          id, name, status, created_at,
          company:companies (id, name)
        `)
        .eq('organization_id', organizationId)
        .in('company_id', referredCompanyIds)
        .order('created_at', { ascending: false });

      if (projectsError) {
        logger.error('Error loading referred projects:', projectsError);
      } else {
        // Transform company from array to single object (Supabase returns array for joins)
        referredProjects = (projects || []).map(p => ({
          ...p,
          company: Array.isArray(p.company) && p.company.length > 0 ? p.company[0] : null,
        }));
      }
    }

    // Get commissions
    const { data: commissions, error: commError } = await adminClient
      .from('partner_commissions')
      .select(`
        id, commission_rate, base_amount, commission_amount, status, 
        payment_reference, notes, created_at, paid_at,
        opportunity:opportunities (id, name, value)
      `)
      .eq('organization_id', organizationId)
      .eq('partner_company_id', partnerId)
      .order('created_at', { ascending: false });

    if (commError) {
      logger.error('Error loading commissions:', commError);
    }

    // Calculate summary stats
    const opportunities = referredOpportunities || [];
    const convertedOpps = opportunities.filter(o => o.status === 'converted');
    const totalRevenue = convertedOpps.reduce((sum, o) => sum + (o.value || 0), 0);
    const pipelineValue = opportunities
      .filter(o => ['new', 'working', 'negotiation', 'pending'].includes(o.status))
      .reduce((sum, o) => sum + (o.value || 0), 0);

    const allCommissions = commissions || [];
    const pendingCommission = allCommissions
      .filter(c => c.status === 'pending' || c.status === 'approved')
      .reduce((sum, c) => sum + c.commission_amount, 0);
    const paidCommission = allCommissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + c.commission_amount, 0);

    return NextResponse.json({
      partner: {
        id: partner.id,
        name: partner.name,
        commission_rate: partner.partner_commission_rate,
      },
      summary: {
        referred_companies_count: (referredCompanies || []).length,
        referred_opportunities_count: opportunities.length,
        converted_opportunities_count: convertedOpps.length,
        referred_projects_count: referredProjects.length,
        total_revenue: totalRevenue,
        pipeline_value: pipelineValue,
        pending_commission: pendingCommission,
        paid_commission: paidCommission,
        total_commission: pendingCommission + paidCommission,
      },
      referred_companies: referredCompanies || [],
      referred_opportunities: referredOpportunities || [],
      referred_projects: referredProjects,
      commissions: commissions || [],
    });
  } catch (error) {
    logger.error('Error in GET /api/ops/partners/[id]/stats:', error);
    return internalError('Failed to load partner stats', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

