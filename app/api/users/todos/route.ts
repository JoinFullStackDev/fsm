import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { unauthorized, notFound, internalError } from '@/lib/utils/apiErrors';
import logger from '@/lib/utils/logger';
import type { ProjectTask, Project } from '@/types/project';

// Mark this route as dynamic since it uses cookies for authentication
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TodoItem {
  id: string;
  type: 'task' | 'phase';
  title: string;
  description?: string | null;
  project_id: string;
  project_name: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  due_date?: string | null;
  status?: 'todo' | 'in_progress' | 'done' | 'archived';
  phase_number?: number;
  phase_name?: string;
  url: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return unauthorized('You must be logged in to view todos');
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      return notFound('User not found');
    }

    const userId = userData.id;
    const todos: TodoItem[] = [];

    // Get all projects user is a member of (owner or member)
    const { data: ownedProjects } = await supabase
      .from('projects')
      .select('id, name')
      .eq('owner_id', userId);

    const { data: memberProjects } = await supabase
      .from('project_members')
      .select('project_id, projects(id, name)')
      .eq('user_id', userId);

    const allProjectIds = new Set<string>();
    const projectMap = new Map<string, string>();

    (ownedProjects || []).forEach((p) => {
      allProjectIds.add(p.id);
      projectMap.set(p.id, p.name);
    });

    (memberProjects || []).forEach((mp: any) => {
      if (mp.projects) {
        allProjectIds.add(mp.projects.id);
        projectMap.set(mp.projects.id, mp.projects.name);
      }
    });

    if (allProjectIds.size === 0) {
      return NextResponse.json({ todos: [] });
    }

    // Get all assigned tasks (not done, not archived)
    const { data: tasks, error: tasksError } = await supabase
      .from('project_tasks')
      .select('*')
      .in('project_id', Array.from(allProjectIds))
      .eq('assignee_id', userId)
      .in('status', ['todo', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: false });

    if (!tasksError && tasks) {
      tasks.forEach((task: ProjectTask) => {
        const projectName = projectMap.get(task.project_id) || 'Unknown Project';
        todos.push({
          id: task.id,
          type: 'task',
          title: task.title,
          description: task.description,
          project_id: task.project_id,
          project_name: projectName,
          priority: task.priority,
          due_date: task.due_date,
          status: task.status,
          url: `/project-management/${task.project_id}?taskId=${task.id}`,
          created_at: task.created_at,
        });
      });
    }

    // If user has tasks, return them (prioritized)
    if (todos.length > 0) {
      // Sort by: priority (critical > high > medium > low), then due_date (earliest first)
      todos.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority || 'medium'];
        const bPriority = priorityOrder[b.priority || 'medium'];
        if (bPriority !== aPriority) {
          return bPriority - aPriority;
        }
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
      return NextResponse.json({ todos: todos.slice(0, 10) }); // Limit to top 10
    }

    // If no tasks, get incomplete phases from user's projects
    // Fallback phase names for backward compatibility
    const defaultPhaseNames: Record<number, string> = {
      1: 'Concept Framing',
      2: 'Product Strategy',
      3: 'Rapid Prototype Definition',
      4: 'Analysis & User Stories',
      5: 'Build Accelerator',
      6: 'QA & Hardening',
    };

    const { data: phases, error: phasesError } = await supabase
      .from('project_phases')
      .select('project_id, phase_number, phase_name, completed, updated_at')
      .in('project_id', Array.from(allProjectIds))
      .eq('completed', false)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (!phasesError && phases) {
      phases.forEach((phase: any) => {
        const projectName = projectMap.get(phase.project_id) || 'Unknown Project';
        const phaseName = phase.phase_name || defaultPhaseNames[phase.phase_number] || `Phase ${phase.phase_number}`;
        todos.push({
          id: `${phase.project_id}-phase-${phase.phase_number}`,
          type: 'phase',
          title: phaseName,
          description: `Help complete this phase in ${projectName}`,
          project_id: phase.project_id,
          project_name: projectName,
          phase_number: phase.phase_number,
          phase_name: phaseName,
          url: `/project/${phase.project_id}/phase/${phase.phase_number}`,
          created_at: phase.updated_at,
        });
      });
    }

    // Sort phases by project name and phase number
    todos.sort((a, b) => {
      if (a.project_name !== b.project_name) {
        return a.project_name.localeCompare(b.project_name);
      }
      return (a.phase_number || 0) - (b.phase_number || 0);
    });

    return NextResponse.json({ todos: todos.slice(0, 10) }); // Limit to top 10
  } catch (error) {
    logger.error('Error fetching todos:', error);
    return internalError('Failed to load todos', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

