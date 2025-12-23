/**
 * Workspace Context Builder
 * Builds comprehensive project context for AI chat assistant
 */

import { createAdminSupabaseClient } from '@/lib/supabaseAdmin';
import logger from '@/lib/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WorkspaceContextData {
  project: {
    name: string;
    description: string | null;
    status: string;
    primary_tool: string | null;
  };
  team: {
    members: Array<{
      user_id: string;
      name: string | null;
      email: string;
      organization_role: string | null;
    }>;
    total_members: number;
  };
  sow: {
    exists: boolean;
    status?: string;
    objectives?: string[];
    deliverables?: string[];
    timeline?: {
      start_date: string;
      end_date: string;
    };
    budget?: {
      estimated_hours?: number;
      total_budget?: number;
    };
  };
  phases: Array<{
    phase_number: number;
    phase_name: string;
    completed: boolean;
    progress: number;
    key_fields: Array<{ key: string; preview: string }>;
    suggested_start_date?: string;
    suggested_end_date?: string;
  }>;
  tasks: {
    total: number;
    by_status: {
      todo: number;
      in_progress: number;
      done: number;
      archived: number;
    };
    by_priority: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
    recent: Array<{
      title: string;
      description: string | null;
      status: string;
      priority: string;
      assignee: string | null;
      assignee_id: string | null;
      phase_number: number | null;
      start_date: string | null;
      due_date: string | null;
      estimated_hours: number | null;
      tags: string[];
      notes: string | null;
      dependencies: string[];
    }>;
  };
  workspace: {
    clarity_specs: Array<{
      version: number;
      status: string;
      problem_statement: string | null;
      business_goals: string[];
      success_metrics: string[];
      ai_readiness_score: number | null;
    }>;
    epics: Array<{
      title: string;
      description: string | null;
      frontend_issues_count: number;
      backend_issues_count: number;
      tasks_generated: boolean;
    }>;
    decisions: Array<{
      title: string;
      decision: string;
      decision_date: string;
    }>;
    debt: Array<{
      title: string;
      severity: string;
      debt_type: string;
    }>;
  };
  metrics: {
    total_metrics: number;
    metrics_on_track: number;
    metrics_at_risk: number;
    recent_metrics: Array<{
      metric_name: string;
      current_value: number | null;
      target_value: number | null;
      health_status: string | null;
    }>;
  };
  discovery: {
    total_insights: number;
    total_experiments: number;
    active_experiments: number;
    validated_hypotheses: number;
    top_feedback_themes: string[];
    recent_insights: Array<{
      title: string;
      insight_type: string;
      pain_points: string[];
    }>;
  };
  strategy: {
    exists: boolean;
    north_star_metric?: string;
    vision_statement?: string;
    strategic_bets?: string[];
    product_principles?: string[];
  };
  roadmap: {
    total_items: number;
    by_bucket: {
      now: number;
      next: number;
      later: number;
    };
    upcoming_releases: Array<{
      release_name: string;
      planned_date: string | null;
      included_features: number;
    }>;
  };
  stakeholders: {
    total_stakeholders: number;
    by_alignment: {
      champion: number;
      supporter: number;
      neutral: number;
      skeptical: number;
      blocker: number;
    };
    key_players: Array<{
      name: string;
      role: string | null;
      alignment_status: string;
      key_concerns: string[];
    }>;
    recent_updates: Array<{
      update_type: string;
      title: string;
      sent_date: string | null;
    }>;
  };
  uploads: {
    total_files: number;
    processed_files: number;
    files: Array<{
      file_name: string;
      file_type: string | null;
      ai_summary: string | null;
      extracted_text_preview: string; // First 500 chars
    }>;
  };
}

/**
 * Build comprehensive workspace context for AI
 */
export async function buildWorkspaceContext(
  projectId: string,
  workspaceId: string,
  supabase?: SupabaseClient
): Promise<WorkspaceContextData> {
  const client = supabase || createAdminSupabaseClient();

  try {
    // Parallel fetch all data with timeout protection
    const fetchWithTimeout = async (promise: Promise<any>, timeoutMs = 5000) => {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      );
      try {
        return await Promise.race([promise, timeout]);
      } catch (error) {
        logger.warn('[Context Builder] Query failed or timed out:', error);
        return { data: null, error };
      }
    };

    const [projectRes, phasesRes, tasksRes, specsRes, epicsRes, decisionsRes, debtRes, membersRes, sowRes, metricsRes, insightsRes, experimentsRes, feedbackRes, strategyRes, roadmapRes, releasesRes, stakeholdersRes, stakeholderUpdatesRes, uploadsRes] = await Promise.all([
      // Project
      client
        .from('projects')
        .select('name, description, status, primary_tool')
        .eq('id', projectId)
        .single(),
      
      // Phases
      client
        .from('project_phases')
        .select('phase_number, phase_name, completed, data')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('phase_number', { ascending: true }),
      
      // Tasks (expanded fields for better AI context - includes notes for full scope)
      client
        .from('project_tasks')
        .select('title, description, status, priority, assignee_id, phase_number, start_date, due_date, estimated_hours, tags, notes, dependencies, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200),
      
      // Clarity specs
      client
        .from('clarity_specs')
        .select('version, status, problem_statement, business_goals, success_metrics, ai_readiness_score')
        .eq('workspace_id', workspaceId)
        .order('version', { ascending: false })
        .limit(20),
      
      // Epic drafts
      client
        .from('epic_drafts')
        .select('title, description, frontend_issues, backend_issues, tasks_generated, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(30),
      
      // Decisions (last 15)
      client
        .from('workspace_decisions')
        .select('title, decision, decision_date')
        .eq('workspace_id', workspaceId)
        .order('decision_date', { ascending: false })
        .limit(15),
      
      // Debt (critical and high only)
      client
        .from('workspace_debt')
        .select('title, severity, debt_type, status')
        .eq('workspace_id', workspaceId)
        .in('severity', ['critical', 'high'])
        .eq('status', 'open')
        .limit(10),
      
      // Project Members with custom organization roles via SOW
      client
        .from('project_scope_of_work')
        .select(`
          id,
          project_members:sow_project_members(
            project_member:project_members!sow_project_members_project_member_id_fkey(
              user_id,
              user:users!project_members_user_id_fkey(
                id,
                name,
                email
              )
            ),
            organization_role:organization_roles!sow_project_members_organization_role_id_fkey(
              id,
              name
            )
          )
        `)
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      
      // SOW (active or most recent)
      client
        .from('scope_of_work')
        .select('status, objectives, deliverables, timeline, budget')
        .eq('project_id', projectId)
        .in('status', ['active', 'approved', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      
      // Success Metrics (expanded for comprehensive AI context)
      client
        .from('workspace_success_metrics')
        .select('metric_name, current_value, target_value, health_status, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(15),
      
      // User Insights (expanded for comprehensive AI context)
      client
        .from('workspace_user_insights')
        .select('title, insight_type, pain_points')
        .eq('workspace_id', workspaceId)
        .order('insight_date', { ascending: false })
        .limit(15),
      
      // Experiments (expanded for comprehensive AI context)
      client
        .from('workspace_experiments')
        .select('title, status, hypothesis_validated')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(15),
      
      // Feedback (reduced to 10 for performance)
      client
        .from('workspace_feedback')
        .select('title, feedback_type, category')
        .eq('workspace_id', workspaceId)
        .in('feedback_type', ['feature_request', 'complaint'])
        .in('status', ['open', 'under_review', 'planned'])
        .order('upvote_count', { ascending: false })
        .limit(10),
      
      // Strategy
      client
        .from('workspace_strategy')
        .select('north_star_metric, vision_statement, strategic_bets, design_principles, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(),
      
      // Roadmap Items (reduced to 10 for performance)
      client
        .from('workspace_roadmap_items')
        .select('title, roadmap_bucket, status')
        .eq('workspace_id', workspaceId)
        .order('priority_score', { ascending: false })
        .limit(10),
      
      // Releases
      client
        .from('workspace_releases')
        .select('release_name, planned_date, included_roadmap_item_ids, status')
        .eq('workspace_id', workspaceId)
        .in('status', ['planning', 'in_progress'])
        .order('planned_date', { ascending: true })
        .limit(5),
      
      // Stakeholders (expanded for comprehensive AI context)
      client
        .from('workspace_stakeholders')
        .select('name, role, power_level, interest_level, alignment_status, key_concerns')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(25),
      
      // Stakeholder Updates
      client
        .from('workspace_stakeholder_updates')
        .select('update_type, title, sent_date')
        .eq('workspace_id', workspaceId)
        .not('sent_date', 'is', null)
        .order('sent_date', { ascending: false })
        .limit(5),
      
      // Project Uploads (for AI context)
      client
        .from('project_uploads')
        .select('file_name, file_type, ai_summary, extracted_text, is_processed, processing_error')
        .eq('project_id', projectId)
        .eq('is_processed', true)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    // Extract key fields from phase data with value previews (expanded for comprehensive AI context)
    const extractKeyFieldsWithValues = (data: any): Array<{ key: string; preview: string }> => {
      if (!data) return [];
      return Object.entries(data)
        .filter(([key, value]) => 
          !key.startsWith('_') && 
          value && 
          !['master_prompt', 'generated_document', 'document_generated_at'].includes(key)
        )
        .slice(0, 15)
        .map(([key, value]) => ({
          key,
          preview: typeof value === 'string'
            ? value.substring(0, 500).replace(/\n/g, ' ')
            : Array.isArray(value)
              ? (value as unknown[]).slice(0, 5).map(v => 
                  typeof v === 'string' ? v : JSON.stringify(v).substring(0, 100)
                ).join(', ')
              : JSON.stringify(value).substring(0, 200),
        }));
    };

    /**
     * Calculate suggested phase date ranges by distributing SOW timeline across phases
     */
    const calculatePhaseDates = (
      phaseCount: number,
      sowTimeline?: { start_date: string; end_date: string }
    ): Map<number, { start: string; end: string }> => {
      const phaseDates = new Map<number, { start: string; end: string }>();
      
      if (!sowTimeline?.start_date || !sowTimeline?.end_date || phaseCount === 0) {
        return phaseDates;
      }

      const startDate = new Date(sowTimeline.start_date);
      const endDate = new Date(sowTimeline.end_date);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysPerPhase = Math.ceil(totalDays / phaseCount);

      for (let i = 1; i <= phaseCount; i++) {
        const phaseStart = new Date(startDate);
        phaseStart.setDate(phaseStart.getDate() + (i - 1) * daysPerPhase);
        
        const phaseEnd = new Date(phaseStart);
        phaseEnd.setDate(phaseEnd.getDate() + daysPerPhase - 1);
        
        // Don't exceed the SOW end date
        if (phaseEnd > endDate) {
          phaseEnd.setTime(endDate.getTime());
        }

        phaseDates.set(i, {
          start: phaseStart.toISOString().split('T')[0],
          end: phaseEnd.toISOString().split('T')[0],
        });
      }

      return phaseDates;
    };

    // Build team summary with custom organization roles from SOW
    const sowMembersData = membersRes.data;
    const members: Array<{
      user_id: string;
      name: string | null;
      email: string;
      organization_role: string | null;
    }> = [];

    if (sowMembersData && sowMembersData.project_members && Array.isArray(sowMembersData.project_members)) {
      // SOW exists with members
      sowMembersData.project_members.forEach((sowMember: any) => {
        if (sowMember.project_member) {
          const pm = Array.isArray(sowMember.project_member) 
            ? sowMember.project_member[0] 
            : sowMember.project_member;
          
          const userData = Array.isArray(pm.user) ? pm.user[0] : pm.user;
          
          // Get organization role name
          let orgRoleName = null;
          if (sowMember.organization_role) {
            const orgRole = Array.isArray(sowMember.organization_role)
              ? sowMember.organization_role[0]
              : sowMember.organization_role;
            orgRoleName = orgRole?.name || null;
          }
          
          members.push({
            user_id: pm.user_id,
            name: userData?.name || null,
            email: userData?.email || 'Unknown',
            organization_role: orgRoleName, // Custom role (e.g., "Software Engineer", "QA Manager")
          });
        }
      });
    } else {
      // Fallback: No SOW or SOW has no members, query project_members directly
      const { data: directMembers } = await client
        .from('project_members')
        .select(`
          user_id,
          organization_role_id,
          organization_role:organization_roles(
            id,
            name
          ),
          user:users!project_members_user_id_fkey(
            id,
            name,
            email
          )
        `)
        .eq('project_id', projectId);

      if (directMembers && directMembers.length > 0) {
        directMembers.forEach((member: any) => {
          const userData = Array.isArray(member.user) ? member.user[0] : member.user;
          const orgRole = Array.isArray(member.organization_role) 
            ? member.organization_role[0] 
            : member.organization_role;
          members.push({
            user_id: member.user_id,
            name: userData?.name || null,
            email: userData?.email || 'Unknown',
            organization_role: orgRole?.name || null,
          });
        });
      }
    }

    // Create lookup map for assignee name resolution
    const userIdToName: Record<string, string> = {};
    members.forEach((m) => {
      if (m.user_id && m.name) {
        userIdToName[m.user_id] = m.name;
      }
    });

    // Get SOW data for phase date calculations
    const sowData = sowRes.data;
    const sowTimeline = sowData?.timeline as { start_date: string; end_date: string } | undefined;
    const phaseCount = (phasesRes.data || []).length;
    const phaseDateRanges = calculatePhaseDates(phaseCount, sowTimeline);

    // Build phases summary with field values and calculated dates
    const phases = (phasesRes.data || []).map((phase) => {
      const dateRange = phaseDateRanges.get(phase.phase_number);
      return {
        phase_number: phase.phase_number,
        phase_name: phase.phase_name,
        completed: phase.completed,
        progress: 0, // Could calculate if needed
        key_fields: extractKeyFieldsWithValues(phase.data),
        suggested_start_date: dateRange?.start,
        suggested_end_date: dateRange?.end,
      };
    });

    // Build tasks summary with assignee names resolved and full details
    const tasks = tasksRes.data || [];
    const tasksSummary = {
      total: tasks.length,
      by_status: {
        todo: tasks.filter((t) => t.status === 'todo').length,
        in_progress: tasks.filter((t) => t.status === 'in_progress').length,
        done: tasks.filter((t) => t.status === 'done').length,
        archived: tasks.filter((t) => t.status === 'archived').length,
      },
      by_priority: {
        low: tasks.filter((t) => t.priority === 'low').length,
        medium: tasks.filter((t) => t.priority === 'medium').length,
        high: tasks.filter((t) => t.priority === 'high').length,
        critical: tasks.filter((t) => t.priority === 'critical').length,
      },
      recent: tasks.slice(0, 100).map((t) => ({
        title: t.title,
        description: t.description || null,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee_id ? (userIdToName[t.assignee_id] || 'Unknown') : null,
        assignee_id: t.assignee_id,
        phase_number: t.phase_number || null,
        start_date: t.start_date || null,
        due_date: t.due_date || null,
        estimated_hours: t.estimated_hours || null,
        tags: t.tags || [],
        notes: t.notes || null,
        dependencies: t.dependencies || [],
      })),
    };

    // Build workspace data
    const clarity_specs = (specsRes.data || []).map((spec) => ({
      version: spec.version,
      status: spec.status,
      problem_statement: spec.problem_statement,
      business_goals: spec.business_goals || [],
      success_metrics: spec.success_metrics || [],
      ai_readiness_score: spec.ai_readiness_score,
    }));

    const epics = (epicsRes.data || []).map((epic) => ({
      title: epic.title,
      description: epic.description,
      frontend_issues_count: Array.isArray(epic.frontend_issues) ? epic.frontend_issues.length : 0,
      backend_issues_count: Array.isArray(epic.backend_issues) ? epic.backend_issues.length : 0,
      tasks_generated: epic.tasks_generated,
    }));

    const decisions = (decisionsRes.data || []).map((d) => ({
      title: d.title,
      decision: d.decision,
      decision_date: d.decision_date,
    }));

    const debt = (debtRes.data || []).map((d) => ({
      title: d.title,
      severity: d.severity,
      debt_type: d.debt_type,
    }));

    // Build SOW summary (sowData already declared above for phase date calculations)
    const sow = sowData
      ? {
          exists: true,
          status: sowData.status,
          objectives: sowData.objectives || [],
          deliverables: sowData.deliverables || [],
          timeline: sowData.timeline,
          budget: sowData.budget,
        }
      : {
          exists: false,
        };

    // Build metrics summary
    const metricsData = metricsRes.data || [];
    const metricsSummary = {
      total_metrics: metricsData.length,
      metrics_on_track: metricsData.filter((m: any) => m.health_status === 'on_track').length,
      metrics_at_risk: metricsData.filter((m: any) => m.health_status === 'at_risk').length,
      recent_metrics: metricsData.slice(0, 5).map((m: any) => ({
        metric_name: m.metric_name,
        current_value: m.current_value,
        target_value: m.target_value,
        health_status: m.health_status,
      })),
    };

    // Build discovery summary
    const insightsData = insightsRes.data || [];
    const experimentsData = experimentsRes.data || [];
    const feedbackData = feedbackRes.data || [];

    // Aggregate feedback categories
    const feedbackCategories = new Map<string, number>();
    feedbackData.forEach((fb: any) => {
      const categories = fb.category || [];
      categories.forEach((cat: string) => {
        feedbackCategories.set(cat, (feedbackCategories.get(cat) || 0) + 1);
      });
    });

    const topFeedbackThemes = Array.from(feedbackCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category]) => category);

    const discoverySummary = {
      total_insights: insightsData.length,
      total_experiments: experimentsData.length,
      active_experiments: experimentsData.filter((e: any) => e.status === 'running').length,
      validated_hypotheses: experimentsData.filter((e: any) => e.hypothesis_validated === true).length,
      top_feedback_themes: topFeedbackThemes,
      recent_insights: insightsData.slice(0, 5).map((i: any) => ({
        title: i.title,
        insight_type: i.insight_type,
        pain_points: i.pain_points || [],
      })),
    };

    // Build strategy summary
    const strategyData = strategyRes.data;
    const strategySummary = {
      exists: !!strategyData,
      north_star_metric: strategyData?.north_star_metric || undefined,
      vision_statement: strategyData?.vision_statement || undefined,
      strategic_bets: strategyData?.strategic_bets?.map((b: any) => b.bet) || undefined,
      product_principles: strategyData?.design_principles || undefined,
    };

    // Build roadmap summary
    const roadmapData = roadmapRes.data || [];
    const releasesData = releasesRes.data || [];
    const roadmapSummary = {
      total_items: roadmapData.length,
      by_bucket: {
        now: roadmapData.filter((i: any) => i.roadmap_bucket === 'now').length,
        next: roadmapData.filter((i: any) => i.roadmap_bucket === 'next').length,
        later: roadmapData.filter((i: any) => i.roadmap_bucket === 'later').length,
      },
      upcoming_releases: releasesData.map((r: any) => ({
        release_name: r.release_name,
        planned_date: r.planned_date,
        included_features: Array.isArray(r.included_roadmap_item_ids) ? r.included_roadmap_item_ids.length : 0,
      })),
    };

    // Build stakeholder summary
    const stakeholdersData = stakeholdersRes.data || [];
    const stakeholderUpdatesData = stakeholderUpdatesRes.data || [];
    const stakeholdersSummary = {
      total_stakeholders: stakeholdersData.length,
      by_alignment: {
        champion: stakeholdersData.filter((s: any) => s.alignment_status === 'champion').length,
        supporter: stakeholdersData.filter((s: any) => s.alignment_status === 'supporter').length,
        neutral: stakeholdersData.filter((s: any) => s.alignment_status === 'neutral').length,
        skeptical: stakeholdersData.filter((s: any) => s.alignment_status === 'skeptical').length,
        blocker: stakeholdersData.filter((s: any) => s.alignment_status === 'blocker').length,
      },
      key_players: stakeholdersData
        .filter((s: any) => s.power_level === 'high' && s.interest_level === 'high')
        .slice(0, 5)
        .map((s: any) => ({
          name: s.name,
          role: s.role,
          alignment_status: s.alignment_status,
          key_concerns: s.key_concerns || [],
        })),
      recent_updates: stakeholderUpdatesData.map((u: any) => ({
        update_type: u.update_type,
        title: u.title,
        sent_date: u.sent_date,
      })),
    };

    // Build uploads summary for AI context
    const uploadsData = uploadsRes.data || [];
    const uploadsSummary = {
      total_files: uploadsData.length,
      processed_files: uploadsData.filter((u: any) => u.is_processed && !u.processing_error).length,
      files: uploadsData
        .filter((u: any) => u.is_processed && !u.processing_error && (u.ai_summary || u.extracted_text))
        .slice(0, 15)
        .map((u: any) => ({
          file_name: u.file_name,
          file_type: u.file_type,
          ai_summary: u.ai_summary || null,
          extracted_text_preview: u.extracted_text 
            ? u.extracted_text.substring(0, 500) + (u.extracted_text.length > 500 ? '...' : '')
            : '',
        })),
    };

    const context: WorkspaceContextData = {
      project: {
        name: projectRes.data?.name || 'Unknown Project',
        description: projectRes.data?.description || null,
        status: projectRes.data?.status || 'idea',
        primary_tool: projectRes.data?.primary_tool || null,
      },
      team: {
        members,
        total_members: members.length,
      },
      sow,
      phases,
      tasks: tasksSummary,
      workspace: {
        clarity_specs,
        epics,
        decisions,
        debt,
      },
      metrics: metricsSummary,
      discovery: discoverySummary,
      strategy: strategySummary,
      roadmap: roadmapSummary,
      stakeholders: stakeholdersSummary,
      uploads: uploadsSummary,
    };

    logger.info('[Context Builder] Context built successfully:', {
      projectId,
      phasesCount: phases.length,
      tasksCount: tasks.length,
      specsCount: clarity_specs.length,
      epicsCount: epics.length,
      teamMembersCount: members.length,
      hasSow: sow.exists,
      uploadsCount: uploadsSummary.total_files,
    });

    return context;
  } catch (error) {
    logger.error('[Context Builder] Failed to build context:', error);
    throw new Error('Failed to build workspace context');
  }
}

/**
 * Format context data into AI-friendly prompt text
 */
export function formatContextForAI(context: WorkspaceContextData): string {
  let prompt = `**PROJECT OVERVIEW:**
Name: ${context.project.name}
Status: ${context.project.status}
${context.project.description ? `Description: ${context.project.description}` : ''}
${context.project.primary_tool ? `Primary Tool: ${context.project.primary_tool}` : ''}

**TEAM MEMBERS (${context.team.total_members} total):**
${context.team.members.map((m) => {
  const displayName = m.name || m.email;
  const role = m.organization_role || 'Team Member';
  return `- ${displayName} (${role}) [ID: ${m.user_id}]`;
}).join('\n')}

${context.sow.exists ? `**SCOPE OF WORK:**
Status: ${context.sow.status}
${context.sow.objectives && context.sow.objectives.length > 0 ? `Objectives:\n${context.sow.objectives.slice(0, 5).map(o => `  - ${o}`).join('\n')}` : ''}
${context.sow.deliverables && context.sow.deliverables.length > 0 ? `Deliverables:\n${context.sow.deliverables.slice(0, 5).map(d => `  - ${d}`).join('\n')}` : ''}
${context.sow.timeline ? `Timeline: ${context.sow.timeline.start_date} to ${context.sow.timeline.end_date}` : ''}
${context.sow.budget?.estimated_hours ? `Estimated Hours: ${context.sow.budget.estimated_hours}h` : ''}
${context.sow.budget?.total_budget ? `Budget: $${context.sow.budget.total_budget}` : ''}

` : ''}**PHASES WITH TIMELINE & CONTENT:**
${context.phases.map((p) => {
  const dateRange = p.suggested_start_date && p.suggested_end_date 
    ? ` (${p.suggested_start_date} to ${p.suggested_end_date})`
    : '';
  const status = p.completed ? 'COMPLETED ✓' : 'In Progress';
  const fieldPreviews = p.key_fields.length > 0 
    ? '\n' + p.key_fields.map(f => `  - ${f.key}: ${f.preview}${f.preview.length >= 500 ? '...' : ''}`).join('\n')
    : '';
  return `- Phase ${p.phase_number}: ${p.phase_name}${dateRange} - ${status}${fieldPreviews}`;
}).join('\n')}

**TASKS SUMMARY:**
- Total Tasks: ${context.tasks.total}
- Status: ${context.tasks.by_status.todo} todo, ${context.tasks.by_status.in_progress} in progress, ${context.tasks.by_status.done} done
- Priority: ${context.tasks.by_priority.critical} critical, ${context.tasks.by_priority.high} high, ${context.tasks.by_priority.medium} medium, ${context.tasks.by_priority.low} low
`;

  // Add all tasks with full details for AI context
  if (context.tasks.recent.length > 0) {
    prompt += `\n**PROJECT TASKS (${context.tasks.recent.length} shown):**\n`;
    prompt += context.tasks.recent.map((t) => {
      const assigneeInfo = t.assignee ? `Assigned: ${t.assignee}` : 'Unassigned';
      const phaseInfo = t.phase_number ? `Phase ${t.phase_number}` : 'No phase';
      const dateInfo = t.start_date || t.due_date 
        ? `${t.start_date || '?'} → ${t.due_date || '?'}`
        : 'No dates';
      const hoursInfo = t.estimated_hours ? `${t.estimated_hours}h` : '';
      const tagsInfo = t.tags.length > 0 ? `[${t.tags.join(', ')}]` : '';
      
      // Build full task details
      let taskDetails = `- [${t.priority.toUpperCase()}] ${t.title} (${t.status}) | ${phaseInfo} | ${dateInfo} | ${assigneeInfo} ${hoursInfo} ${tagsInfo}`;
      
      // Add description (expanded)
      if (t.description) {
        taskDetails += `\n  Description: ${t.description.substring(0, 300)}${t.description.length > 300 ? '...' : ''}`;
      }
      
      // Parse and add notes (contains requirements, user stories, acceptance criteria)
      if (t.notes) {
        try {
          const notesData = JSON.parse(t.notes);
          if (notesData.requirements && Array.isArray(notesData.requirements) && notesData.requirements.length > 0) {
            taskDetails += `\n  Requirements: ${notesData.requirements.slice(0, 5).join('; ')}`;
          }
          if (notesData.userStories && Array.isArray(notesData.userStories) && notesData.userStories.length > 0) {
            taskDetails += `\n  User Stories: ${notesData.userStories.slice(0, 3).join('; ')}`;
          }
          if (notesData.acceptanceCriteria && Array.isArray(notesData.acceptanceCriteria) && notesData.acceptanceCriteria.length > 0) {
            taskDetails += `\n  Acceptance Criteria: ${notesData.acceptanceCriteria.slice(0, 3).join('; ')}`;
          }
          if (notesData.notes && typeof notesData.notes === 'string') {
            taskDetails += `\n  Notes: ${notesData.notes.substring(0, 200)}`;
          }
        } catch {
          // Notes is plain text, not JSON
          if (typeof t.notes === 'string' && t.notes.length > 0) {
            taskDetails += `\n  Notes: ${t.notes.substring(0, 200)}${t.notes.length > 200 ? '...' : ''}`;
          }
        }
      }
      
      // Add dependencies
      if (t.dependencies && t.dependencies.length > 0) {
        taskDetails += `\n  Dependencies: ${t.dependencies.length} task(s)`;
      }
      
      return taskDetails;
    }).join('\n\n');
  }

  // Add clarity specs if available
  if (context.workspace.clarity_specs.length > 0) {
    prompt += `\n\n**CLARITY SPECIFICATIONS:**\n`;
    context.workspace.clarity_specs.forEach((spec) => {
      prompt += `\nVersion ${spec.version} (${spec.status}):\n`;
      if (spec.problem_statement) {
        prompt += `Problem: ${spec.problem_statement.substring(0, 200)}${spec.problem_statement.length > 200 ? '...' : ''}\n`;
      }
      if (spec.business_goals.length > 0) {
        prompt += `Goals: ${spec.business_goals.slice(0, 3).join(', ')}\n`;
      }
      if (spec.ai_readiness_score) {
        prompt += `Readiness Score: ${spec.ai_readiness_score}/10\n`;
      }
    });
  }

  // Add epics if available
  if (context.workspace.epics.length > 0) {
    prompt += `\n**EPIC DRAFTS:**\n`;
    context.workspace.epics.forEach((epic) => {
      prompt += `- "${epic.title}": ${epic.frontend_issues_count} FE issues, ${epic.backend_issues_count} BE issues`;
      if (epic.tasks_generated) {
        prompt += ' (Tasks generated ✓)';
      }
      prompt += '\n';
    });
  }

  // Add decisions if available
  if (context.workspace.decisions.length > 0) {
    prompt += `\n**RECENT DECISIONS:**\n`;
    context.workspace.decisions.forEach((d) => {
      prompt += `- ${d.title}: ${d.decision.substring(0, 150)}${d.decision.length > 150 ? '...' : ''}\n`;
    });
  }

  // Add critical debt if available
  if (context.workspace.debt.length > 0) {
    prompt += `\n**CRITICAL/HIGH DEBT:**\n`;
    context.workspace.debt.forEach((d) => {
      prompt += `- [${d.severity.toUpperCase()}] ${d.title} (${d.debt_type})\n`;
    });
  }

  // Add metrics summary
  if (context.metrics.total_metrics > 0) {
    prompt += `\n**SUCCESS METRICS:**\n`;
    prompt += `Total: ${context.metrics.total_metrics} | On Track: ${context.metrics.metrics_on_track} | At Risk: ${context.metrics.metrics_at_risk}\n`;
    if (context.metrics.recent_metrics.length > 0) {
      prompt += `Recent Metrics:\n`;
      context.metrics.recent_metrics.forEach((m) => {
        const statusLabel = m.health_status ? ` (${m.health_status})` : '';
        const values = m.target_value ? `${m.current_value || 0}/${m.target_value}` : `${m.current_value || '-'}`;
        prompt += `- ${m.metric_name}: ${values}${statusLabel}\n`;
      });
    }
  }

  // Add discovery summary
  if (context.discovery.total_insights > 0 || context.discovery.total_experiments > 0) {
    prompt += `\n**DISCOVERY & VALIDATION:**\n`;
    prompt += `Insights: ${context.discovery.total_insights} | Experiments: ${context.discovery.total_experiments} (${context.discovery.active_experiments} active)\n`;
    if (context.discovery.validated_hypotheses > 0) {
      prompt += `Validated Hypotheses: ${context.discovery.validated_hypotheses}\n`;
    }
    if (context.discovery.top_feedback_themes.length > 0) {
      prompt += `Top Feedback Themes: ${context.discovery.top_feedback_themes.join(', ')}\n`;
    }
    if (context.discovery.recent_insights.length > 0) {
      prompt += `Recent Insights:\n`;
      context.discovery.recent_insights.slice(0, 3).forEach((i) => {
        const painPoints = i.pain_points.length > 0 ? ` (${i.pain_points.length} pain points)` : '';
        prompt += `- [${i.insight_type}] ${i.title}${painPoints}\n`;
      });
    }
  }

  // Add strategy
  if (context.strategy.exists) {
    prompt += `\n**PRODUCT STRATEGY:**\n`;
    if (context.strategy.north_star_metric) {
      prompt += `North Star: ${context.strategy.north_star_metric}\n`;
    }
    if (context.strategy.vision_statement) {
      prompt += `Vision: ${context.strategy.vision_statement.substring(0, 200)}${context.strategy.vision_statement.length > 200 ? '...' : ''}\n`;
    }
    if (context.strategy.strategic_bets && context.strategy.strategic_bets.length > 0) {
      prompt += `Strategic Bets: ${context.strategy.strategic_bets.slice(0, 3).join(', ')}\n`;
    }
  }

  // Add roadmap
  if (context.roadmap.total_items > 0) {
    prompt += `\n**ROADMAP:**\n`;
    prompt += `Total Items: ${context.roadmap.total_items} | Now: ${context.roadmap.by_bucket.now} | Next: ${context.roadmap.by_bucket.next} | Later: ${context.roadmap.by_bucket.later}\n`;
    if (context.roadmap.upcoming_releases.length > 0) {
      prompt += `Upcoming Releases:\n`;
      context.roadmap.upcoming_releases.forEach((r) => {
        prompt += `- ${r.release_name} (${r.included_features} features) - ${r.planned_date || 'TBD'}\n`;
      });
    }
  }

  // Add stakeholders
  if (context.stakeholders.total_stakeholders > 0) {
    prompt += `\n**STAKEHOLDER MANAGEMENT:**\n`;
    prompt += `Total Stakeholders: ${context.stakeholders.total_stakeholders}\n`;
    prompt += `Alignment: ${context.stakeholders.by_alignment.champion} champions, ${context.stakeholders.by_alignment.supporter} supporters, ${context.stakeholders.by_alignment.neutral} neutral, ${context.stakeholders.by_alignment.skeptical} skeptical, ${context.stakeholders.by_alignment.blocker} blockers\n`;
    
    if (context.stakeholders.key_players.length > 0) {
      prompt += `Key Players (High Power/High Interest):\n`;
      context.stakeholders.key_players.forEach((s) => {
        const concerns = s.key_concerns.length > 0 ? ` - Concerns: ${s.key_concerns.slice(0, 2).join(', ')}` : '';
        prompt += `- ${s.name}${s.role ? ` (${s.role})` : ''} - ${s.alignment_status}${concerns}\n`;
      });
    }
    
    if (context.stakeholders.recent_updates.length > 0) {
      prompt += `Recent Updates:\n`;
      context.stakeholders.recent_updates.forEach((u) => {
        const date = u.sent_date ? new Date(u.sent_date).toLocaleDateString() : 'Draft';
        prompt += `- [${u.update_type}] ${u.title} (${date})\n`;
      });
    }
  }

  // Add uploaded documents context
  if (context.uploads && context.uploads.total_files > 0) {
    prompt += `\n**UPLOADED DOCUMENTS (${context.uploads.processed_files} processed of ${context.uploads.total_files} total):**\n`;
    
    if (context.uploads.files.length > 0) {
      context.uploads.files.forEach((file) => {
        const fileType = file.file_type ? `[${file.file_type.toUpperCase()}]` : '[FILE]';
        prompt += `\n${fileType} ${file.file_name}:\n`;
        
        if (file.ai_summary) {
          prompt += `Summary: ${file.ai_summary}\n`;
        }
        
        if (file.extracted_text_preview && !file.ai_summary) {
          prompt += `Content Preview: ${file.extracted_text_preview}\n`;
        }
      });
    } else {
      prompt += `Files are being processed...\n`;
    }
  }

  return prompt;
}
