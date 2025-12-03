import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import { getUserOrganizationId } from '@/lib/organizationContext';
import { unauthorized, notFound, internalError, badRequest, conflict } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import { convertOpportunityToProject } from '@/lib/ops/opportunityConversion';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('You must be logged in to convert opportunities');
    }

    const { id: opportunityId } = params;

    // Use admin client to bypass RLS and avoid stack depth recursion issues
    const adminClient = createAdminSupabaseClient();

    // Get user record using admin client
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return notFound('User');
    }

    // Get opportunity using admin client
    const { data: opportunity, error: opportunityError } = await adminClient
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single();

    if (opportunityError || !opportunity) {
      if (opportunityError?.code === 'PGRST116') {
        return notFound('Opportunity not found');
      }
      logger.error('Error loading opportunity:', opportunityError);
      return internalError('Failed to load opportunity', { error: opportunityError?.message });
    }

    // Check if opportunity is already converted
    if (opportunity.status === 'converted') {
      // Check if project already exists using admin client
      const { data: existingProject } = await adminClient
        .from('projects')
        .select('id')
        .eq('opportunity_id', opportunityId)
        .single();

      if (existingProject) {
        return conflict('This opportunity has already been converted to a project');
      }
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(supabase, user.id);
    if (!organizationId) {
      return badRequest('User is not assigned to an organization');
    }

    // Get request body for template_id, member_ids, and generate_invoice
    const body = await request.json().catch(() => ({}));
    const { template_id, member_ids, generate_invoice } = body;

    // Convert opportunity to project using admin client
    const project = await convertOpportunityToProject(
      adminClient,
      opportunity,
      userData.id,
      organizationId,
      template_id || null,
      member_ids || []
    );

    // Update opportunity status to 'converted' using admin client
    await adminClient
      .from('opportunities')
      .update({ status: 'converted' })
      .eq('id', opportunityId);

    // Generate invoice if requested
    let invoice = null;
    if (generate_invoice) {
      try {
        const { createInvoice } = await import('@/lib/ops/invoices');
        
        // Get company details for invoice
        const { data: company } = await adminClient
          .from('companies')
          .select('name')
          .eq('id', opportunity.company_id)
          .single();

        // Get primary contact email
        const { data: contacts } = await adminClient
          .from('company_contacts')
          .select('email')
          .eq('company_id', opportunity.company_id)
          .limit(1);

        const clientEmail = contacts && contacts.length > 0 ? contacts[0].email : null;
        const clientName = company?.name || opportunity.name;

        // Create invoice
        invoice = await createInvoice(supabase, {
          organization_id: organizationId,
          project_id: project.id,
          opportunity_id: opportunity.id,
          company_id: opportunity.company_id,
          client_name: clientName,
          client_email: clientEmail,
          line_items: [{
            description: `Project: ${opportunity.name}`,
            quantity: 1,
            unit_price: opportunity.value || 0,
            amount: opportunity.value || 0,
          }],
          issue_date: new Date().toISOString().split('T')[0],
          status: 'draft',
          created_by: userData.id,
        });
      } catch (invoiceError) {
        logger.error('Error generating invoice during conversion:', invoiceError);
        // Don't fail conversion if invoice generation fails
      }
    }

    return NextResponse.json({ project, invoice }, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/ops/opportunities/[id]/convert:', error);
    return internalError('Failed to convert opportunity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

