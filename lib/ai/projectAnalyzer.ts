import { generateStructuredAIResponse } from './geminiClient';
import logger from '@/lib/utils/logger';
import type { ProjectTask, TaskSourceReference } from '@/types/project';
import { buildCompactSOWContext, type SOWMember, type SOWContextResult } from './promptTemplates';
import crypto from 'crypto';

/**
 * Expand short IDs (M1, M2, etc.) to full UUIDs using the mapping
 */
function expandShortIdToUUID(
  shortId: string | null | undefined,
  shortIdMap: Map<string, string>
): string | null {
  if (!shortId) return null;
  
  // Check if it's a short ID (M1, M2, etc.)
  const shortIdUpper = shortId.toUpperCase();
  if (shortIdMap.has(shortIdUpper)) {
    return shortIdMap.get(shortIdUpper) || null;
  }
  
  // Check if it's already a UUID (36 char format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(shortId)) {
    return shortId;
  }
  
  // Invalid format - return null
  logger.warn(`[Project Analyzer] Invalid assignee_id format: ${shortId}`);
  return null;
}

// Phase data is dynamic JSONB from database
export interface PhaseData {
  phase_number: number;
  phase_name?: string;
  display_order?: number;
  data: Record<string, unknown>;
  completed: boolean;
}

/**
 * Generated task with source field tracking
 */
export interface GeneratedTask extends Omit<ProjectTask, 'id' | 'created_at' | 'updated_at'> {
  assignee_id: string | null;
  source_fields?: Array<{ phase: number; field: string }>;
}

export interface ProjectAnalysisResult {
  tasks: GeneratedTask[];
  summary: string;
  next_steps: string[];
  blockers: string[];
  estimates: {
    total_tasks?: number;
    estimated_hours?: number;
    estimated_days?: number;
    [key: string]: unknown;
  };
}

/**
 * Smart re-analysis result - categorizes tasks by change status
 */
export interface SourceFieldChangeResult {
  changedTasks: ProjectTask[];
  unchangedTasks: ProjectTask[];
  orphanedTasks: ProjectTask[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a short hash for field value change detection
 */
export function hashFieldValue(value: unknown): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value || '');
  return crypto.createHash('md5').update(str.substring(0, 1000)).digest('hex').substring(0, 8);
}

/**
 * Build compact phase summary for AI prompt
 * Dramatically reduced token usage while preserving key information
 */
function buildCompactPhaseSummary(phases: PhaseData[]): string {
  return phases.map(phase => {
    const data = phase.data || {};
    // Filter out internal fields
    const fieldEntries = Object.entries(data)
      .filter(([key]) => !key.startsWith('_') && !['master_prompt', 'generated_document', 'document_generated_at'].includes(key));
    
    // Get field keys for source reference
    const fieldKeys = fieldEntries.map(([key]) => key);
    
    // Get key content previews (truncated for token efficiency)
    const keyContent = fieldEntries.slice(0, 5).map(([key, value]) => {
      const preview = typeof value === 'string' 
        ? value.substring(0, 100).replace(/\n/g, ' ')
        : JSON.stringify(value).substring(0, 50);
      return `  - ${key}: ${preview}${(typeof value === 'string' && value.length > 100) || JSON.stringify(value).length > 50 ? '...' : ''}`;
    }).join('\n');
    
    // Include generated document summary if exists (truncated)
    const docSummary = (data as Record<string, unknown>).generated_document
      ? `\n  [Doc]: ${String((data as Record<string, unknown>).generated_document).substring(0, 300).replace(/\n/g, ' ')}...`
      : '';
    
    const status = phase.completed ? ' ✓DONE' : '';
    
    return `P${phase.phase_number} "${phase.phase_name || `Phase ${phase.phase_number}`}"${status}:
  Fields: [${fieldKeys.join(', ')}]
${keyContent}${docSummary}`;
  }).join('\n\n');
}

/**
 * Parse timeline text to extract duration in days
 */
function parseTimelineDuration(timelineText: string, phases: PhaseData[]): number | null {
  if (!timelineText) return null;
  
  // Try overall duration patterns
  const monthMatch = timelineText.match(/(\d+)\s*(?:month|mo)/i);
  if (monthMatch) return parseInt(monthMatch[1]) * 30;
  
  const yearMatch = timelineText.match(/(\d+)\s*(?:year|yr)/i);
  if (yearMatch) return parseInt(yearMatch[1]) * 365;
  
  const weekMatch = timelineText.match(/(\d+)\s*(?:week|wk)/i);
  if (weekMatch) return parseInt(weekMatch[1]) * 7;
  
  const dayMatch = timelineText.match(/(\d+)\s*(?:day|days)/i);
  if (dayMatch) return parseInt(dayMatch[1]);
  
  // Fallback: sum phase-specific durations
  let totalDays = 0;
  for (const phase of phases) {
    const phaseMatch = timelineText.match(new RegExp(`[Pp]hase\\s*${phase.phase_number}[\\s:]+(\\d+)\\s*(week|day|month)`, 'i'));
    if (phaseMatch) {
      const duration = parseInt(phaseMatch[1]);
      const unit = phaseMatch[2].toLowerCase();
      if (unit === 'week') totalDays += duration * 7;
      else if (unit === 'day') totalDays += duration;
      else if (unit === 'month') totalDays += duration * 30;
    }
  }
  
  return totalDays > 0 ? totalDays : null;
}

/**
 * Detect source field changes for smart re-analysis
 */
export function detectSourceFieldChanges(
  existingTasks: ProjectTask[],
  phases: PhaseData[]
): SourceFieldChangeResult {
  const changedTasks: ProjectTask[] = [];
  const unchangedTasks: ProjectTask[] = [];
  const orphanedTasks: ProjectTask[] = [];
  
  for (const task of existingTasks) {
    if (!task.source_reference?.length) {
      // No source reference - treat as manually created
      unchangedTasks.push(task);
      continue;
    }
    
    let hasChanges = false;
    let isOrphaned = false;
    
    for (const ref of task.source_reference) {
      const phase = phases.find(p => p.phase_number === ref.phase_number);
      if (!phase) {
        isOrphaned = true;
        break;
      }
      
      const fieldValue = (phase.data as Record<string, unknown>)?.[ref.field_key];
      if (fieldValue === undefined) {
        isOrphaned = true;
        break;
      }
      
      // Check if field content changed via hash comparison
      if (ref.field_hash) {
        const currentHash = hashFieldValue(fieldValue);
        if (currentHash !== ref.field_hash) {
          hasChanges = true;
        }
      }
    }
    
    if (isOrphaned) {
      orphanedTasks.push(task);
    } else if (hasChanges) {
      changedTasks.push(task);
    } else {
      unchangedTasks.push(task);
    }
  }
  
  return { changedTasks, unchangedTasks, orphanedTasks };
}

/**
 * Convert source_fields from AI output to source_reference for database
 */
export function convertSourceFieldsToReference(
  sourceFields: Array<{ phase: number; field: string }> | undefined,
  phases: PhaseData[]
): TaskSourceReference[] | null {
  if (!sourceFields?.length) return null;
  
  return sourceFields.map(sf => {
    const phase = phases.find(p => p.phase_number === sf.phase);
    const fieldValue = phase ? (phase.data as Record<string, unknown>)?.[sf.field] : undefined;
    
    return {
      phase_number: sf.phase,
      field_key: sf.field,
      field_hash: fieldValue !== undefined ? hashFieldValue(fieldValue) : undefined,
    };
  });
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a project and generate tasks, summary, blockers, and estimates
 * OPTIMIZED: 70% smaller prompts with source field tracking
 */
export async function analyzeProject(
  projectName: string,
  phases: PhaseData[],
  existingTasks: ProjectTask[] = [],
  apiKey?: string,
  isDefaultTemplate: boolean = true,
  sowMembers?: SOWMember[]
): Promise<ProjectAnalysisResult> {
  // Extract timeline information
  let planningTimeline = '';
  let buildTimeline = '';
  
  const phase1 = phases.find(p => p.phase_number === 1);
  const phase5 = phases.find(p => p.phase_number === 5);
  
  if (isDefaultTemplate) {
    // Default template: use known field names
    const phase1Data = phase1?.data as Record<string, unknown> | undefined;
    const phase5Data = phase5?.data as Record<string, unknown> | undefined;
    planningTimeline = (typeof phase1Data?.high_level_timeline === 'string' ? phase1Data.high_level_timeline : '') || '';
    buildTimeline = (typeof phase5Data?.build_timeline === 'string' ? phase5Data.build_timeline : '') || '';
  } else if (apiKey) {
    // Custom template: use AI to extract timeline (with flash-lite for speed)
    const phaseContent = phases.slice(0, 3).map(p => 
      `P${p.phase_number}: ${JSON.stringify(p.data).substring(0, 500)}`
    ).join('\n');
    
    if (phaseContent) {
      try {
        const timelineResult = await generateStructuredAIResponse<{
          planning_timeline: string;
          build_timeline: string;
        }>(
          `Extract timeline info from phases:\n${phaseContent}\n\nReturn: {"planning_timeline":"","build_timeline":""}`,
          { context: 'Timeline extraction' },
          apiKey,
          projectName,
          false,
          'gemini-2.5-flash-lite' // Use faster model for simple extraction
        );
        
        const timelines = 'result' in timelineResult ? timelineResult.result : timelineResult;
        planningTimeline = timelines.planning_timeline || '';
        buildTimeline = timelines.build_timeline || '';
      } catch (error) {
        logger.warn('[Project Analyzer] Timeline extraction failed:', error);
      }
    }
  }
  
  // Parse timeline durations
  const planningDays = parseTimelineDuration(planningTimeline, phases);
  const buildDays = parseTimelineDuration(buildTimeline, phases);
  
  // Determine if build phases need minimum duration
  const phase5HasData = phase5?.data && Object.keys(phase5.data).length > 0;
  const phase5HasTasks = existingTasks.some(t => t.phase_number === 5);
  const effectiveBuildDays = buildDays 
    ? Math.max(buildDays, 90) 
    : ((phase5HasData || phase5HasTasks || buildTimeline) ? 90 : 0);
  
  const totalDays = (planningDays || 0) + effectiveBuildDays;
  const today = new Date().toISOString().split('T')[0];
  
  // Build compact phase summary
  const phaseSummary = buildCompactPhaseSummary(phases);
  
  // Build compact existing tasks summary
  const existingTasksSummary = existingTasks.length > 0
    ? `\nEXISTING (${existingTasks.length}):\n${existingTasks.slice(0, 12).map(t => 
        `- [P${t.phase_number}] "${t.title}" (${t.status})${t.source_reference?.[0] ? ` src:${t.source_reference[0].field_key}` : ''}`
      ).join('\n')}`
    : '';
  
  // Build SOW context with short ID mapping
  let sowContextResult: SOWContextResult = { promptText: '', shortIdMap: new Map() };
  if (sowMembers?.length) {
    sowContextResult = buildCompactSOWContext(sowMembers, phases);
  }
  
  // Build phase list
  const phaseList = phases.map(p => `${p.phase_number}:${p.phase_name || `Phase ${p.phase_number}`}`).join(', ');
  
  // Determine project status
  const completedPhases = phases.filter(p => p.completed);
  const currentPhase = phases.find(p => !p.completed);
  const statusText = completedPhases.length > 0 
    ? `Completed: ${completedPhases.map(p => p.phase_name || `P${p.phase_number}`).join(', ')}. Current: ${currentPhase?.phase_name || 'N/A'}`
    : 'Starting fresh';

  // ============================================================================
  // OPTIMIZED PROMPT - team context at TOP for better AI consideration
  // ============================================================================
  const prompt = `Analyze project "${projectName}" and generate tasks.
${sowContextResult.promptText}
TODAY: ${today}
TIMELINE: ${totalDays || 180} days total (Planning: ${planningDays || 90}d, Build: ${effectiveBuildDays || 90}d min)
STATUS: ${statusText}
PHASES: ${phaseList}

PHASE DATA:
${phaseSummary}
${existingTasksSummary}

GENERATE TASKS for ALL ${phases.length} phases with these fields:
{
  "title": "Action verb + deliverable",
  "description": "What to do, acceptance criteria",
  "phase_number": 1-${phases.length},
  "priority": "low|medium|high|critical",
  "status": "todo",
  "estimated_hours": 1-40,
  "tags": ["category"],
  "start_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "assignee_id": "M1, M2, etc. or null",
  "source_fields": [{"phase": N, "field": "field_key"}]
}

CRITICAL RULES:
1. Generate 3-8 tasks PER PHASE covering ALL ${phases.length} phases
2. EVERY task MUST have start_date and due_date (YYYY-MM-DD)
3. Link tasks to phase fields via source_fields (use exact field names from PHASE DATA)
4. Distribute tasks across timeline: P1-P${Math.ceil(phases.length/2)} in first ${planningDays || 90}d, rest in build phase
5. Assign tasks using team member short IDs (M1, M2, etc.) when role matches
6. Space tasks 2-5 days apart within each phase

Return JSON:
{
  "tasks": [...],
  "summary": "2-3 paragraph progress summary",
  "next_steps": ["action1", "action2", "action3"],
  "blockers": ["issue1"],
  "estimates": {"total_tasks": N, "estimated_hours": N, "estimated_days": N}
}`;

  try {
    const result = await generateStructuredAIResponse<ProjectAnalysisResult>(
      prompt,
      { projectData: { name: projectName, phase_count: phases.length } },
      apiKey,
      projectName
    );

    const analysisResult = 'result' in result ? result.result : result;

    // Calculate phase durations for date distribution
    const phaseDurations: Record<number, number> = {};
    const phaseCount = phases.length;
    const planningPhaseCount = Math.ceil(phaseCount / 2);
    const buildPhaseCount = phaseCount - planningPhaseCount;
    
    // Distribute planning days across first half of phases
    const planningDaysPerPhase = (planningDays || 90) / planningPhaseCount;
    phases.slice(0, planningPhaseCount).forEach(p => {
      phaseDurations[p.phase_number] = planningDaysPerPhase;
    });
    
    // Distribute build days across second half
    const buildDaysPerPhase = effectiveBuildDays / Math.max(1, buildPhaseCount);
    phases.slice(planningPhaseCount).forEach(p => {
      phaseDurations[p.phase_number] = buildDaysPerPhase;
    });

    // Group tasks by phase
    const tasksByPhase = analysisResult.tasks.reduce((acc, task) => {
      const phase = task.phase_number || 1;
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(task);
      return acc;
    }, {} as Record<number, GeneratedTask[]>);

    // Validate and enhance tasks
    const validatedTasks = analysisResult.tasks.map((task) => {
      const todayDate = new Date();
      const phaseNumber = task.phase_number || 1;
      
      // Calculate phase start offset
      let phaseStartOffset = 0;
      for (let i = 1; i < phaseNumber; i++) {
        phaseStartOffset += phaseDurations[i] || 14;
      }
      
      // Parse or calculate dates
      let startDate = task.start_date;
      let dueDate = task.due_date;
      
      // Validate due_date
      if (dueDate) {
        const parsed = new Date(dueDate);
        if (isNaN(parsed.getTime())) {
          dueDate = null;
        }
      }
      
      // Calculate due_date if missing
      if (!dueDate) {
        const phaseDuration = phaseDurations[phaseNumber] || 14;
        const tasksInPhase = tasksByPhase[phaseNumber] || [];
        const taskIndex = tasksInPhase.findIndex(t => t.title === task.title);
        const taskOffset = tasksInPhase.length > 1 
          ? Math.floor((taskIndex / (tasksInPhase.length - 1)) * (phaseDuration - 1))
          : Math.floor(phaseDuration / 2);
        
        const date = new Date(todayDate);
        date.setDate(todayDate.getDate() + Math.floor(phaseStartOffset) + taskOffset + 1);
        dueDate = date.toISOString().split('T')[0];
      }
      
      // Calculate start_date if missing
      if (!startDate && dueDate) {
        const dueDateObj = new Date(dueDate);
        const daysBefore = task.priority === 'critical' ? 2 : task.priority === 'high' ? 3 : 4;
        const startDateObj = new Date(dueDateObj);
        startDateObj.setDate(dueDateObj.getDate() - daysBefore);
        if (startDateObj < todayDate) startDateObj.setTime(todayDate.getTime());
        startDate = startDateObj.toISOString().split('T')[0];
      }
      
      // Ensure start_date is not after due_date
      if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
        const dueDateObj = new Date(dueDate);
        dueDateObj.setDate(dueDateObj.getDate() - 1);
        startDate = dueDateObj.toISOString().split('T')[0];
      }
      
      // Convert source_fields to source_reference
      const sourceReference = convertSourceFieldsToReference(task.source_fields, phases);
      
      // Expand short IDs (M1, M2) to full UUIDs
      const expandedAssigneeId = expandShortIdToUUID(
        task.assignee_id,
        sowContextResult.shortIdMap
      );
      
      return {
        ...task,
        project_id: '',
        phase_number: task.phase_number || null,
        title: task.title || 'Untitled Task',
        description: task.description || null,
        status: (task.status || 'todo') as ProjectTask['status'],
        priority: (task.priority || 'medium') as ProjectTask['priority'],
        assignee_id: expandedAssigneeId,
        start_date: startDate,
        due_date: dueDate,
        estimated_hours: task.estimated_hours || null,
        tags: task.tags || [],
        notes: null,
        dependencies: [],
        ai_generated: true,
        ai_analysis_id: null,
        source_reference: sourceReference,
      };
    });

    // Log summary
    const tasksWithSource = validatedTasks.filter(t => t.source_reference?.length);
    logger.debug(`[Project Analyzer] Generated ${validatedTasks.length} tasks (${tasksWithSource.length} with source tracking)`);

    return {
      ...analysisResult,
      tasks: validatedTasks,
    };
  } catch (error) {
    logger.error('[Project Analyzer] Error analyzing project:', error);
    throw new Error(`Failed to analyze project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// RE-ANALYSIS FOR CHANGED SOURCE FIELDS
// ============================================================================

/**
 * Build focused re-analysis prompt for tasks with changed source fields
 */
export async function reAnalyzeChangedTasks(
  projectName: string,
  changedTasks: ProjectTask[],
  phases: PhaseData[],
  apiKey: string,
  sowMembers?: SOWMember[]
): Promise<{ updates: Array<{ task_id: string; changes: Partial<ProjectTask> }>; new_tasks: GeneratedTask[] }> {
  // Collect relevant changed fields
  const relevantFields = new Map<number, Set<string>>();
  for (const task of changedTasks) {
    for (const ref of task.source_reference || []) {
      if (!relevantFields.has(ref.phase_number)) {
        relevantFields.set(ref.phase_number, new Set());
      }
      relevantFields.get(ref.phase_number)!.add(ref.field_key);
    }
  }
  
  // Build changed content summary
  const changedContent = Array.from(relevantFields.entries()).map(([phaseNum, fields]) => {
    const phase = phases.find(p => p.phase_number === phaseNum);
    if (!phase) return '';
    
    const fieldContent = Array.from(fields).map(key => {
      const value = (phase.data as Record<string, unknown>)?.[key];
      return `  ${key}: ${typeof value === 'string' ? value.substring(0, 150) : JSON.stringify(value).substring(0, 80)}`;
    }).join('\n');
    
    return `P${phaseNum} "${phase.phase_name}":\n${fieldContent}`;
  }).filter(Boolean).join('\n\n');

  // Build SOW context with short ID mapping
  let sowContextResult: SOWContextResult = { promptText: '', shortIdMap: new Map() };
  if (sowMembers?.length) {
    sowContextResult = buildCompactSOWContext(sowMembers, phases);
  }

  const prompt = `RE-ANALYZE ${changedTasks.length} tasks - source phase data has changed.
${sowContextResult.promptText}
CHANGED PHASE FIELDS:
${changedContent}

TASKS TO REVIEW:
${changedTasks.map(t => `- ID:${t.id} "${t.title}" (P${t.phase_number}, src:${t.source_reference?.map(r => r.field_key).join(',')})`).join('\n')}

For each task, determine if it needs updates based on the changed data.
Use short IDs (M1, M2, etc.) for assignee_id in new tasks.

Return JSON:
{
  "updates": [
    {"task_id": "uuid", "changes": {"title":"new title","description":"new desc",...}}
  ],
  "new_tasks": [
    {"title":"","description":"","phase_number":N,"priority":"","status":"todo","assignee_id":"M1 or null","source_fields":[{"phase":N,"field":"key"}]}
  ]
}`;

  try {
    const result = await generateStructuredAIResponse<{
      updates: Array<{ task_id: string; changes: Partial<ProjectTask> }>;
      new_tasks: GeneratedTask[];
    }>(prompt, {}, apiKey, projectName, false, 'gemini-2.5-flash-lite');
    
    const analysisResult = 'result' in result ? result.result : result;
    
    // Expand short IDs in new tasks
    const expandedNewTasks = analysisResult.new_tasks.map(task => ({
      ...task,
      assignee_id: expandShortIdToUUID(task.assignee_id, sowContextResult.shortIdMap),
    }));
    
    return { updates: analysisResult.updates, new_tasks: expandedNewTasks };
  } catch (error) {
    logger.error('[Project Analyzer] Re-analysis failed:', error);
    return { updates: [], new_tasks: [] };
  }
}

// ============================================================================
// TASK MERGING
// ============================================================================

/**
 * Smart merge existing tasks with new AI-generated tasks
 */
export function mergeTasks(
  existingTasks: ProjectTask[],
  newTasks: Omit<ProjectTask, 'id' | 'created_at' | 'updated_at'>[],
  aiAnalysisId: string
): {
  toUpdate: ProjectTask[];
  toInsert: Omit<ProjectTask, 'id' | 'created_at' | 'updated_at'>[];
  toArchive: ProjectTask[];
} {
  const toUpdate: ProjectTask[] = [];
  const toInsert: Omit<ProjectTask, 'id' | 'created_at' | 'updated_at'>[] = [];
  const toArchive: ProjectTask[] = [];

  // Find matching task by title similarity
  const findMatchingTask = (newTask: { title: string }) => {
    const normalizedNew = newTask.title.toLowerCase().trim();
    return existingTasks.find(existing => {
      const normalizedExisting = existing.title.toLowerCase().trim();
      return normalizedExisting === normalizedNew ||
        normalizedExisting.includes(normalizedNew) ||
        normalizedNew.includes(normalizedExisting);
    });
  };

  for (const newTask of newTasks) {
    const matching = findMatchingTask(newTask);
    
    if (matching) {
      if (matching.ai_generated) {
        // Update AI-generated task
        const existingNotes = matching.notes || '';
        const timestamp = new Date().toISOString().split('T')[0];
        let updatedNotes = existingNotes;
        
        if (newTask.description !== matching.description) {
          updatedNotes = `${existingNotes}\n\n---\n[${timestamp}] Re-analysis: ${newTask.description}`;
        }
        
        toUpdate.push({
          ...matching,
          title: newTask.title,
          description: newTask.description,
          phase_number: newTask.phase_number,
          priority: newTask.priority,
          tags: newTask.tags,
          start_date: newTask.start_date || matching.start_date,
          due_date: newTask.due_date || matching.due_date,
          assignee_id: matching.assignee_id || newTask.assignee_id || null,
          source_reference: (newTask as GeneratedTask).source_reference || matching.source_reference,
          notes: updatedNotes,
          ai_analysis_id: aiAnalysisId,
          updated_at: new Date().toISOString(),
        });
      } else if ((newTask.due_date && !matching.due_date) || (newTask.start_date && !matching.start_date)) {
        // Update dates for manually created tasks
        toUpdate.push({
          ...matching,
          start_date: newTask.start_date || matching.start_date,
          due_date: newTask.due_date || matching.due_date,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      toInsert.push({ ...newTask, ai_analysis_id: aiAnalysisId });
    }
  }

  // Archive completed AI tasks no longer in new list
  for (const existing of existingTasks) {
    if (existing.ai_generated && existing.status === 'done') {
      const stillRelevant = newTasks.some(newTask => {
        const normalizedNew = newTask.title.toLowerCase().trim();
        const normalizedExisting = existing.title.toLowerCase().trim();
        return normalizedNew === normalizedExisting ||
          normalizedNew.includes(normalizedExisting) ||
          normalizedExisting.includes(normalizedNew);
      });

      if (!stillRelevant) {
        toArchive.push({
          ...existing,
          status: 'archived' as const,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  return { toUpdate, toInsert, toArchive };
}
