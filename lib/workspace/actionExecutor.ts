/**
 * Action Executor
 * Executes AI-suggested actions after user confirmation
 */

import logger from '@/lib/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Execute create_task action
 */
export async function executeCreateTask(
  data: Record<string, unknown>,
  projectId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown>> {
  try {
    const { title, description, priority, status, estimated_hours, tags, assignee_id } = data;

    if (!title) {
      throw new Error('Task title is required');
    }

    const taskData = {
      project_id: projectId,
      title: String(title),
      description: description ? String(description) : null,
      status: status || 'todo',
      priority: priority || 'medium',
      assignee_id: assignee_id ? String(assignee_id) : null,
      estimated_hours: estimated_hours || null,
      tags: Array.isArray(tags) ? tags : [],
      ai_generated: true,
      notes: 'Created by AI Workspace Assistant',
    };

    const { data: task, error } = await supabase
      .from('project_tasks')
      .insert(taskData)
      .select('id, title, assignee_id')
      .single();

    if (error || !task) {
      logger.error('[Action Executor] Failed to create task:', error);
      throw new Error('Failed to create task');
    }

    logger.info('[Action Executor] Task created:', { 
      taskId: task.id, 
      assigneeId: task.assignee_id 
    });

    return {
      task_id: task.id,
      task_title: task.title,
      assignee_id: task.assignee_id,
    };
  } catch (error) {
    logger.error('[Action Executor] Create task failed:', error);
    throw error;
  }
}

/**
 * Execute log_decision action
 */
export async function executeLogDecision(
  data: Record<string, unknown>,
  workspaceId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown>> {
  try {
    const { title, decision, context, rationale } = data;

    if (!title || !decision) {
      throw new Error('Decision title and decision are required');
    }

    const decisionData = {
      workspace_id: workspaceId,
      title: String(title),
      decision: String(decision),
      context: context ? String(context) : null,
      rationale: rationale ? String(rationale) : null,
      decision_date: new Date().toISOString().split('T')[0],
      tags: ['ai-suggested'],
    };

    const { data: decisionRecord, error } = await supabase
      .from('workspace_decisions')
      .insert(decisionData)
      .select('id, title')
      .single();

    if (error || !decisionRecord) {
      logger.error('[Action Executor] Failed to log decision:', error);
      throw new Error('Failed to log decision');
    }

    logger.info('[Action Executor] Decision logged:', { decisionId: decisionRecord.id });

    return {
      decision_id: decisionRecord.id,
      decision_title: decisionRecord.title,
    };
  } catch (error) {
    logger.error('[Action Executor] Log decision failed:', error);
    throw error;
  }
}

/**
 * Execute log_debt action
 */
export async function executeLogDebt(
  data: Record<string, unknown>,
  workspaceId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown>> {
  try {
    const { title, description, debt_type, severity } = data;

    if (!title || !description || !debt_type) {
      throw new Error('Title, description, and debt_type are required');
    }

    const debtData = {
      workspace_id: workspaceId,
      title: String(title),
      description: String(description),
      debt_type: String(debt_type),
      severity: severity || 'medium',
      identified_date: new Date().toISOString().split('T')[0],
      status: 'open',
    };

    const { data: debtRecord, error } = await supabase
      .from('workspace_debt')
      .insert(debtData)
      .select('id, title')
      .single();

    if (error || !debtRecord) {
      logger.error('[Action Executor] Failed to log debt:', error);
      throw new Error('Failed to log debt');
    }

    logger.info('[Action Executor] Debt logged:', { debtId: debtRecord.id });

    return {
      debt_id: debtRecord.id,
      debt_title: debtRecord.title,
    };
  } catch (error) {
    logger.error('[Action Executor] Log debt failed:', error);
    throw error;
  }
}

/**
 * Execute update_spec action
 */
export async function executeUpdateSpec(
  data: Record<string, unknown>,
  workspaceId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown>> {
  try {
    const { spec_id, updates } = data;

    if (!spec_id || !updates) {
      throw new Error('Spec ID and updates are required');
    }

    // Verify spec belongs to workspace
    const { data: spec } = await supabase
      .from('clarity_specs')
      .select('id')
      .eq('id', String(spec_id))
      .eq('workspace_id', workspaceId)
      .single();

    if (!spec) {
      throw new Error('Clarity spec not found or access denied');
    }

    // Update spec
    const { error } = await supabase
      .from('clarity_specs')
      .update(updates as any)
      .eq('id', String(spec_id));

    if (error) {
      logger.error('[Action Executor] Failed to update spec:', error);
      throw new Error('Failed to update clarity spec');
    }

    logger.info('[Action Executor] Spec updated:', { specId: spec_id });

    return {
      spec_id: spec_id,
      updated_fields: Object.keys(updates as any),
    };
  } catch (error) {
    logger.error('[Action Executor] Update spec failed:', error);
    throw error;
  }
}
