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
    key_fields: string[];
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
      status: string;
      priority: string;
      assignee: string | null;
      assignee_id: string | null;
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
    // Parallel fetch all data
    const [projectRes, phasesRes, tasksRes, specsRes, epicsRes, decisionsRes, debtRes, membersRes, sowRes] = await Promise.all([
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
      
      // Tasks
      client
        .from('project_tasks')
        .select('title, status, priority, assignee_id, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50),
      
      // Clarity specs
      client
        .from('clarity_specs')
        .select('version, status, problem_statement, business_goals, success_metrics, ai_readiness_score')
        .eq('workspace_id', workspaceId)
        .order('version', { ascending: false })
        .limit(5),
      
      // Epic drafts
      client
        .from('epic_drafts')
        .select('title, description, frontend_issues, backend_issues, tasks_generated, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Decisions (last 5)
      client
        .from('workspace_decisions')
        .select('title, decision, decision_date')
        .eq('workspace_id', workspaceId)
        .order('decision_date', { ascending: false })
        .limit(5),
      
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
    ]);

    // Extract key fields from phase data (first 3 non-empty fields)
    const extractKeyFields = (data: any): string[] => {
      if (!data) return [];
      return Object.keys(data)
        .filter(key => !key.startsWith('_') && data[key])
        .slice(0, 3);
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

    // Build phases summary
    const phases = (phasesRes.data || []).map((phase) => ({
      phase_number: phase.phase_number,
      phase_name: phase.phase_name,
      completed: phase.completed,
      progress: 0, // Could calculate if needed
      key_fields: extractKeyFields(phase.data),
    }));

    // Build tasks summary with assignee names resolved
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
      recent: tasks.slice(0, 10).map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee_id ? (userIdToName[t.assignee_id] || 'Unknown') : null,
        assignee_id: t.assignee_id,
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

    // Build SOW summary
    const sowData = sowRes.data;
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
    };

    logger.info('[Context Builder] Context built successfully:', {
      projectId,
      phasesCount: phases.length,
      tasksCount: tasks.length,
      specsCount: clarity_specs.length,
      epicsCount: epics.length,
      teamMembersCount: members.length,
      hasSow: sow.exists,
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

` : ''}**PHASES PROGRESS:**
${context.phases.map((p) => `- Phase ${p.phase_number}: ${p.phase_name} - ${p.completed ? 'COMPLETED ✓' : 'In Progress'}`).join('\n')}

**TASKS SUMMARY:**
- Total Tasks: ${context.tasks.total}
- Status: ${context.tasks.by_status.todo} todo, ${context.tasks.by_status.in_progress} in progress, ${context.tasks.by_status.done} done
- Priority: ${context.tasks.by_priority.critical} critical, ${context.tasks.by_priority.high} high, ${context.tasks.by_priority.medium} medium, ${context.tasks.by_priority.low} low
`;

  // Add recent tasks if available (with assignees)
  if (context.tasks.recent.length > 0) {
    prompt += `\n**RECENT TASKS:**\n`;
    prompt += context.tasks.recent.slice(0, 5).map((t) => {
      const assigneeInfo = t.assignee ? ` - Assigned to: ${t.assignee}` : ' - Unassigned';
      return `- [${t.priority.toUpperCase()}] ${t.title} (${t.status})${assigneeInfo}`;
    }).join('\n');
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

  return prompt;
}
