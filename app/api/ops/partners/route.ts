import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { unauthorized, internalError, badRequest, forbidden } from '@/lib/utils/apiErrors';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { hasOpsTool } from '@/lib/packageLimits';
import logger from '@/lib/utils/logger';
import type { PartnerCompanyWithStats, PartnerCompanyOption } from '@/types/ops';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ops/partners
 * Returns all partner companies with their referral statistics
 * Query params:
 * - simple: if "true", returns only id and name for dropdown usage
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized('You must be logged in to view partners');
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

    const { searchParams } = new URL(request.url);
    const simple = searchParams.get('simple') === 'true';

    const adminClient = createAdminSupabaseClient();

    // Simple query for dropdown options
    if (simple) {
      const { data: partners, error: partnersError } = await adminClient
        .from('companies')
        .select('id, name, partner_commission_rate')
        .eq('organization_id', organizationId)
        .eq('is_partner', true)
        .order('name', { ascending: true });

      if (partnersError) {
        logger.error('Error loading partner options:', partnersError);
        return internalError('Failed to load partners', { error: partnersError.message });
      }

      return NextResponse.json(partners as PartnerCompanyOption[]);
    }

    // Full query with stats
    const { data: partners, error: partnersError } = await adminClient
      .from('companies')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_partner', true)
      .order('name', { ascending: true });

    if (partnersError) {
      logger.error('Error loading partners:', partnersError);
      return internalError('Failed to load partners', { error: partnersError.message });
    }

    // Get stats for each partner
    const partnersWithStats: PartnerCompanyWithStats[] = await Promise.all(
      (partners || []).map(async (partner) => {
        // Get referred companies
        const { data: referredCompanies } = await adminClient
          .from('companies')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('referred_by_company_id', partner.id);

        const referredCompanyIds = (referredCompanies || []).map(c => c.id);
        const referredCompaniesCount = referredCompanyIds.length;

        // Get referred opportunities
        const { data: referredOpportunities } = await adminClient
          .from('opportunities')
          .select('id, value, status')
          .eq('organization_id', organizationId)
          .eq('referred_by_company_id', partner.id);

        const referredOpportunitiesCount = referredOpportunities?.length || 0;

        // Calculate revenue from converted opportunities
        const totalReferredRevenue = (referredOpportunities || [])
          .filter(opp => opp.status === 'converted')
          .reduce((sum, opp) => sum + (opp.value || 0), 0);

        // Get projects from referred companies
        let referredProjectsCount = 0;
        if (referredCompanyIds.length > 0) {
          const { count } = await adminClient
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .in('company_id', referredCompanyIds);
          referredProjectsCount = count || 0;
        }

        // Get commission totals
        const { data: commissions } = await adminClient
          .from('partner_commissions')
          .select('commission_amount, status')
          .eq('organization_id', organizationId)
          .eq('partner_company_id', partner.id);

        const totalCommissionDue = (commissions || [])
          .filter(c => c.status === 'pending' || c.status === 'approved')
          .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

        const totalCommissionPaid = (commissions || [])
          .filter(c => c.status === 'paid')
          .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

        return {
          ...partner,
          referred_companies_count: referredCompaniesCount,
          referred_opportunities_count: referredOpportunitiesCount,
          referred_projects_count: referredProjectsCount,
          total_referred_revenue: totalReferredRevenue,
          total_commission_due: totalCommissionDue,
          total_commission_paid: totalCommissionPaid,
        };
      })
    );

    return NextResponse.json({
      data: partnersWithStats,
      total: partnersWithStats.length,
    });
  } catch (error) {
    logger.error('Error in GET /api/ops/partners:', error);
    return internalError('Failed to load partners', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

