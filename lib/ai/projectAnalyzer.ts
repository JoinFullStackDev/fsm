import { generateStructuredAIResponse } from './geminiClient';
import logger from '@/lib/utils/logger';
import type { ProjectTask, ProjectAnalysis } from '@/types/project';
import { computePhaseRoleMapping } from './phaseRoleMapping';
import { buildSOWMembersContext } from './promptTemplates';

// Phase data is dynamic JSONB from database
export interface PhaseData {
  phase_number: number;
  phase_name?: string;
  display_order?: number;
  data: Record<string, unknown>;
  completed: boolean;
}

export interface ProjectAnalysisResult {
  tasks: Array<Omit<ProjectTask, 'id' | 'created_at' | 'updated_at'> & {
    assignee_id?: string | null;
  }>;
  summary: string;
  next_steps: string[];
  blockers: string[];
  estimates: {
    total_tasks?: number;
    estimated_hours?: number;
    estimated_days?: number;
    [key: string]: any;
  };
}


/**
 * Analyze a project and generate tasks, summary, blockers, and estimates
 * @param isDefaultTemplate - If true, uses field-based extraction. If false, searches phase content.
 */
export async function analyzeProject(
  projectName: string,
  phases: PhaseData[],
  existingTasks: ProjectTask[] = [],
  apiKey?: string,
  isDefaultTemplate: boolean = true,
  sowMembers?: Array<{
    user_id: string;
    name: string;
    role_name: string;
    role_description: string | null;
    current_task_count: number;
    is_overworked: boolean;
  }>
): Promise<ProjectAnalysisResult> {
  let phase1Timeline = '';
  let phase5Timeline = '';
  
  // Find phases for later use (needed for phase5HasData check)
  const phase1 = phases.find((p) => p.phase_number === 1);
  const phase5 = phases.find((p) => p.phase_number === 5);
  
  if (isDefaultTemplate) {
    // Default template: use specific field extraction
    // The default template has known field names we can directly access
    const phase1Data = phase1?.data as Record<string, unknown> | undefined;
    const phase5Data = phase5?.data as Record<string, unknown> | undefined;
    phase1Timeline = (typeof phase1Data?.high_level_timeline === 'string' ? phase1Data.high_level_timeline : '') || '';
    phase5Timeline = (typeof phase5Data?.build_timeline === 'string' ? phase5Data.build_timeline : '') || '';
  } else {
    // Custom template: use AI to extract timeline information from phase content
    // Since custom templates have dynamic fields, we need to search through all content
    // First, collect content from phases 1 and 2 (most likely to contain timeline info)
    const phase1 = phases.find((p) => p.phase_number === 1);
    const phase2 = phases.find((p) => p.phase_number === 2);
    
    // Build content string from phases 1 and 2 (optimized: compact JSON)
    const phaseContent: string[] = [];
    if (phase1?.data) {
      // Use compact JSON (no pretty printing) to reduce token count
      phaseContent.push(`Phase 1 (${phase1.phase_name || 'Phase 1'}): ${JSON.stringify(phase1.data)}`);
    }
    if (phase2?.data) {
      phaseContent.push(`Phase 2 (${phase2.phase_name || 'Phase 2'}): ${JSON.stringify(phase2.data)}`);
    }
    
    // If no timeline found in phases 1-2, check other phases
    if (phaseContent.length === 0) {
      for (const phase of phases) {
        if (phase.phase_number !== 1 && phase.phase_number !== 2 && phase.data) {
          phaseContent.push(`Phase ${phase.phase_number} (${phase.phase_name || `Phase ${phase.phase_number}`}): ${JSON.stringify(phase.data)}`);
        }
      }
    }
    
    // Use AI to extract timeline information from phase content (optimized prompt)
    if (phaseContent.length > 0 && apiKey) {
      try {
        const timelineExtractionPrompt = `Extract timeline/duration info from project phases. Look for: project timelines (e.g., "3 months"), phase durations, planning timelines (phases 1-4), build timelines (phases 5-6), dates/deadlines, duration estimates.

Phase Content:
${phaseContent.join('\n\n')}

Return JSON:
{
  "planning_timeline": "extracted planning timeline or empty string",
  "build_timeline": "extracted build timeline or empty string",
  "overall_timeline": "extracted overall timeline or empty string"
}

If no timeline found, return empty strings.`;

        const timelineResult = await generateStructuredAIResponse<{
          planning_timeline: string;
          build_timeline: string;
          overall_timeline: string;
        }>(
          timelineExtractionPrompt,
          {
            context: 'Extract timeline information from project phases',
          },
          apiKey,
          projectName
        );
        
        // Handle both wrapped and unwrapped results
        const timelines = 'result' in timelineResult ? timelineResult.result : timelineResult;
        
        // Use extracted timelines
        phase1Timeline = timelines.planning_timeline || timelines.overall_timeline || '';
        phase5Timeline = timelines.build_timeline || '';
        
        // If still no timeline, try a simpler text-based search as fallback
        if (!phase1Timeline && !phase5Timeline) {
          const allContent = phaseContent.join('\n');
          
          // Look for common timeline patterns
          const timelinePatterns = [
            /timeline[:\s]+([^.\n]{10,200})/gi,
            /duration[:\s]+([^.\n]{10,200})/gi,
            /(\d+\s*(?:week|month|day|year)s?[^.\n]{0,100})/gi,
            /(?:complete|finish|done|deliver|launch).*?(\d+\s*(?:week|month|day|year)s?)/gi,
          ];
          
          for (const pattern of timelinePatterns) {
            const matches = allContent.match(pattern);
            if (matches && matches.length > 0) {
              phase1Timeline = matches.slice(0, 3).join('; '); // Take first 3 matches
              break;
            }
          }
        }
      } catch (error) {
        logger.warn('[Project Analyzer] Failed to extract timeline with AI, using fallback:', error);
        // Fallback to simple text search
        const allContent = phaseContent.join('\n');
        const timelineMatch = allContent.match(/(?:timeline|duration)[:\s]+([^.\n]{10,200})/gi);
        if (timelineMatch) {
          phase1Timeline = timelineMatch[0];
        }
      }
    }
  }
  
  /**
   * Parse timeline text to extract duration in days
   * 
   * Supports multiple formats:
   * - Overall duration: "3 months", "6 months", "1 year"
   * - Phase-specific durations: "Phase 1: 2 weeks", "Phase 2: 1 month"
   * - Multiple units: days, weeks, months, years
   * 
   * If phase-specific durations are found, they are summed together.
   * Returns null if no duration can be parsed.
   */
  const parseTimelineDuration = (timelineText: string): number | null => {
    if (!timelineText) return null;
    
    // Look for overall duration patterns first (e.g., "3 months", "6 months", "1 year")
    // These take precedence over phase-specific durations
    const monthMatch = timelineText.match(/(\d+)\s*(?:month|mo)/i);
    if (monthMatch) {
      return parseInt(monthMatch[1]) * 30; // Convert months to days (approximate)
    }
    
    const yearMatch = timelineText.match(/(\d+)\s*(?:year|yr)/i);
    if (yearMatch) {
      return parseInt(yearMatch[1]) * 365; // Convert years to days
    }
    
    const weekMatch = timelineText.match(/(\d+)\s*(?:week|wk)/i);
    if (weekMatch) {
      return parseInt(weekMatch[1]) * 7; // Convert weeks to days
    }
    
    const dayMatch = timelineText.match(/(\d+)\s*(?:day|days)/i);
    if (dayMatch) {
      return parseInt(dayMatch[1]);
    }
    
    // Fallback: Look for phase-specific durations and sum them
    // Example: "Phase 1: 2 weeks, Phase 2: 1 month" -> sum all durations
    // Use actual phase numbers from the project (dynamic, not hardcoded 1-6)
    let totalDays = 0;
    const phaseNumbers = phases.map(p => p.phase_number).sort((a, b) => a - b);
    for (const phaseNum of phaseNumbers) {
      const phaseMatch = timelineText.match(new RegExp(`[Pp]hase\\s*${phaseNum}[\\s:]+(\\d+)\\s*(week|day|month)`, 'i'));
      if (phaseMatch) {
        const duration = parseInt(phaseMatch[1]);
        const unit = phaseMatch[2].toLowerCase();
        if (unit === 'week') {
          totalDays += duration * 7;
        } else if (unit === 'day') {
          totalDays += duration;
        } else if (unit === 'month') {
          totalDays += duration * 30; // Approximate
        }
      }
    }
    
    return totalDays > 0 ? totalDays : null;
  };
  
  // Parse durations from both timelines
  const phase1Days = parseTimelineDuration(phase1Timeline);
  const phase5Days = parseTimelineDuration(phase5Timeline);
  
  // Check if Phase 5 has tasks or data (to determine if we need minimum 90 days)
  const phase5HasTasks = existingTasks.some((t) => t.phase_number === 5);
  const phase5HasData = phase5 && phase5.data && Object.keys(phase5.data).length > 0;
  const phase5NeedsMinimum = phase5HasTasks || phase5HasData || phase5Timeline.length > 0;
  
  // Ensure Phase 5 gets minimum 90 days if it has a timeline or tasks/data
  const effectivePhase5Days = phase5Days 
    ? Math.max(phase5Days, 90) 
    : (phase5NeedsMinimum ? 90 : 0);
  
  // Combine timelines: Phase 1 timeline + Phase 5 timeline
  const totalProjectDays = (phase1Days || 0) + effectivePhase5Days;
  
  // For backward compatibility, also create combined timeline string
  const combinedTimeline = phase1Timeline 
    ? (phase5Timeline ? `${phase1Timeline} + Build Phase: ${phase5Timeline}` : phase1Timeline)
    : phase5Timeline;
  
  // Determine current project state - find the highest completed phase
  const highestCompletedPhase = phases
    .filter((p) => p.completed)
    .reduce((max, p) => Math.max(max, p.phase_number), 0);
  const currentPhase = phases.find((p) => !p.completed && p.phase_number > highestCompletedPhase);
  
  // Build comprehensive prompt (optimized: summarize phase data instead of full JSON)
  const phaseSummaries = phases.map((phase) => ({
    phase: phase.phase_name || `Phase ${phase.phase_number}`,
    phase_number: phase.phase_number,
    completed: phase.completed,
    // Include key fields from phase data
    key_data: Object.entries(phase.data || {})
      .filter(([key]) => !key.startsWith('_') && key !== 'master_prompt' && key !== 'generated_document' && key !== 'document_generated_at')
      .slice(0, 20) // Limit to prevent token overflow
      .map(([key, value]) => ({ 
        field: key, 
        value: typeof value === 'string' ? value.substring(0, 500) : value 
      })),
    // Include generated document if available
    generated_document: (phase.data as any)?.generated_document 
      ? String((phase.data as any).generated_document).substring(0, 2000) 
      : null,
  }));

  const existingTasksSummary = existingTasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    phase_number: task.phase_number,
    start_date: task.start_date,
    due_date: task.due_date,
  }));

  // Build dynamic phase list from actual phases
  const phaseList = phases
    .map((p) => `${p.phase_number}. ${p.phase_name || `Phase ${p.phase_number}`}`)
    .join('\n');

  const prompt = `You are analyzing a project called "${projectName}"${isDefaultTemplate ? ' that uses The FullStack Method™ framework' : ''}.

The project has ${phases.length} phase${phases.length !== 1 ? 's' : ''} with the following structure:
${phaseList}

IMPORTANT: The phase names above are the EXACT phase names used by this project. When generating tasks, you MUST use these exact phase names in your output. Do NOT use generic phase names like "Concept", "Strategy", "Prototype" unless those are the actual phase names listed above.

Current Phase Status:
${JSON.stringify(phaseSummaries, null, 2)}

${(() => {
  // Build a section highlighting generated phase documents
  const phasesWithDocs = phaseSummaries.filter(p => p.generated_document);
  if (phasesWithDocs.length > 0) {
    return `\n\n=== PHASE OVERVIEW DOCUMENTS ===
The following phases have generated overview documents that contain detailed information about requirements, scope, and deliverables. Use these documents to create accurate, context-aware tasks:

${phasesWithDocs.map(p => `
Phase ${p.phase_number} (${p.phase}):
${p.generated_document}
`).join('\n---\n')}

CRITICAL: When generating tasks for phases with overview documents, ensure tasks align with the information, requirements, and scope outlined in those documents.`;
  }
  return '';
})()}

${existingTasks.length > 0 ? `Existing Tasks:\n${JSON.stringify(existingTasksSummary, null, 2)}` : 'No existing tasks.'}

${combinedTimeline ? `\n\n=== CRITICAL: TIMELINE-BASED DATE ASSIGNMENT ===
Timeline Information:
${phase1Timeline ? `Planning Timeline (from ${phases.find(p => p.phase_number === 1)?.phase_name || 'Phase 1'}): ${phase1Timeline}` : 'No planning timeline provided.'}
${phase5Timeline ? `Build Timeline (from ${phases.find(p => p.phase_number >= 5)?.phase_name || 'build phase'}): ${phase5Timeline}` : 'No build timeline provided.'}
${phase5NeedsMinimum && !phase5Days ? `Note: Build phases will use minimum 90 days for full scale build.` : ''}

Current date (TODAY): ${new Date().toISOString().split('T')[0]}
${totalProjectDays ? `Total Project Duration: ${totalProjectDays} days (approximately ${Math.round(totalProjectDays / 30)} months)
  - Planning phases: ${phase1Days || 0} days
  - Build phases: ${effectivePhase5Days} days (minimum 90 days for full scale build)` : 'Could not parse total project duration from timelines.'}
${highestCompletedPhase > 0 ? `Project Status: ${phases.filter(p => p.completed).map(p => p.phase_name || `Phase ${p.phase_number}`).join(', ')} are COMPLETED. Currently working on ${currentPhase?.phase_name || `Phase ${currentPhase?.phase_number || highestCompletedPhase + 1}`}.` : `Project Status: Just starting - ${phases[0]?.phase_name || 'Phase 1'} is the first phase.`}

YOU MUST ASSIGN A due_date (YYYY-MM-DD format) TO EVERY SINGLE TASK. NO EXCEPTIONS. THIS IS MANDATORY.

Date Assignment Rules:
1. TOTAL project duration = Planning timeline + Build timeline:
   - Planning timeline covers early phases: ${phases.filter(p => {
     const buildPhaseStart = phases.findIndex(p => 
       p.phase_name?.toLowerCase().includes('build') || 
       p.phase_name?.toLowerCase().includes('development') ||
       p.phase_number >= 5
     );
     return buildPhaseStart === -1 || p.phase_number < (buildPhaseStart >= 0 ? phases[buildPhaseStart].phase_number : phases.length);
   }).map(p => p.phase_name || `Phase ${p.phase_number}`).join(', ')}
   - Build timeline covers build/development phases: ${phases.filter(p => {
     const buildPhaseStart = phases.findIndex(p => 
       p.phase_name?.toLowerCase().includes('build') || 
       p.phase_name?.toLowerCase().includes('development') ||
       p.phase_number >= 5
     );
     if (buildPhaseStart >= 0) {
       return p.phase_number >= phases[buildPhaseStart].phase_number;
     }
     return p.phase_number > Math.ceil(phases.length / 2);
   }).map(p => p.phase_name || `Phase ${p.phase_number}`).join(', ')}
   - Build phases should be at least 90 days for full scale builds
   - If build timeline is less than 90 days, use 90 days minimum
   - IMPORTANT: This project has ${phases.length} phases total: ${phases.map(p => `${p.phase_number}. ${p.phase_name || `Phase ${p.phase_number}`}`).join(', ')}. You MUST generate tasks for ALL ${phases.length} phases.

2. Calculate dates based on:
   - Start date: ${new Date().toISOString().split('T')[0]} (TODAY - this is when work begins)
   - End date: ${totalProjectDays ? new Date(Date.now() + totalProjectDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 'Calculate from timeline'}
   - Total duration: ${totalProjectDays || 'Parse from timeline'} days
   - Planning phases: ${phase1Days || 0} days
   - Build phases: ${effectivePhase5Days} days
   - Project status: ${highestCompletedPhase > 0 ? `${phases.filter(p => p.completed).map(p => p.phase_name || `Phase ${p.phase_number}`).join(', ')} are done` : 'Starting fresh'}

3. DISTRIBUTE TASKS across the timeline for ALL ${phases.length} phases:
   - Planning phases: Distribute across planning timeline duration (${phase1Days || 'parse from planning timeline'} days)
   - Build phases: Distribute across build timeline duration (${effectivePhase5Days} days minimum)
   - Each phase should have multiple tasks (typically 3-8 tasks per phase depending on complexity)
   - Build phase tasks should start AFTER planning phases completion
   - Space tasks evenly across each phase's portion of the timeline
   - Tasks should be 2-5 days apart (not all on the same day)
   - CRITICAL: Generate tasks for phases ${phases.map(p => p.phase_number).join(', ')} - DO NOT skip any phases

4. Phase distribution example:
   - Planning timeline: ${phase1Days || 90} days (covers planning phases)
   - Build timeline: ${effectivePhase5Days} days (covers build phases, minimum 90 days)
   - Total: ${totalProjectDays} days
   - Planning phase tasks: Days 1-${phase1Days || 90}
   - Build phase tasks: Days ${(phase1Days || 90) + 1}-${totalProjectDays}

5. ${highestCompletedPhase > 0 ? `IMPORTANT: Since ${phases.filter(p => p.completed).map(p => p.phase_name || `Phase ${p.phase_number}`).join(', ')} are completed, calculate where we are in the timeline and assign dates accordingly. Completed phase tasks should have dates in the past or very near future.` : 'All phases are upcoming - assign dates starting from today forward.'}

6. EVERY task in your response MUST include: "due_date": "YYYY-MM-DD"
   - Never return null
   - Never omit the field
   - Always use valid date format
   - Calculate based on TODAY + appropriate offset based on phase and timeline
   - Build phase tasks must account for the build timeline (minimum 90 days)
   
7. CRITICAL REQUIREMENT: Generate tasks for ALL ${phases.length} phases listed above. Do not limit yourself to any specific number. This project has phases: ${phases.map(p => `${p.phase_number}. ${p.phase_name || `Phase ${p.phase_number}`}`).join(', ')}. Each phase should have multiple relevant tasks.

Return due_date for EVERY task in the format "YYYY-MM-DD".` : `\n\nCurrent date: ${new Date().toISOString().split('T')[0]}
${highestCompletedPhase > 0 ? `Project Status: Phases 1-${highestCompletedPhase} are COMPLETED.` : 'Project Status: Just starting.'}

Since no timeline is provided, assign dates based on:
- Phase order (${phases.map(p => `Phase ${p.phase_number}`).join(' → ')})
- Current date as starting point
- Realistic estimates (2 weeks per phase, tasks spaced 1-3 days apart)
- Build phases should be at least 90 days for full scale builds
- ${highestCompletedPhase > 0 ? `Completed phases should have past dates or very near future dates.` : 'All phases are upcoming.'}
- CRITICAL: Generate tasks for ALL ${phases.length} phases: ${phases.map(p => `Phase ${p.phase_number} (${p.phase_name || `Phase ${p.phase_number}`})`).join(', ')}. Do not skip any phases.

EVERY task must have a due_date in YYYY-MM-DD format.`}

${(() => {
  // Use cached phase role mapping utility
  const phaseRoleMapping = computePhaseRoleMapping(phases);

  // Use shared SOW members context utility
  return sowMembers && sowMembers.length > 0
    ? buildSOWMembersContext(sowMembers, phases)
    : '';
})()}

Based on the phase data provided, generate:
1. A comprehensive task list organized by phase. CRITICAL: You MUST generate tasks for ALL ${phases.length} phases listed above (${phases.map(p => `Phase ${p.phase_number}: ${p.phase_name || `Phase ${p.phase_number}`}`).join(', ')}). Each phase should have multiple tasks (typically 3-8 tasks per phase). Do not limit yourself to only the first few phases. Each task MUST have:
   - title: Clear, actionable task title
   - description: Detailed description of what needs to be done
   - phase_number: Which phase this task belongs to (must be one of: ${phases.map(p => p.phase_number).join(', ')})
   - priority: 'low', 'medium', 'high', or 'critical'
   - status: 'todo' (for new tasks) or match existing status if task already exists
   - estimated_hours: Estimated number of hours to complete this task (decimal number, e.g., 2.5, 8.0, 16.0). Consider task complexity, scope, and typical work patterns. Simple tasks: 1-4 hours, Medium: 4-16 hours, Complex: 16-40 hours, Very complex: 40+ hours.
   - tags: Array of relevant tags (e.g., ['frontend', 'backend', 'design', 'testing'])
   - start_date: ISO date string (YYYY-MM-DD) - REQUIRED FOR ALL TASKS. The date when work should begin on this task. Should be before or equal to due_date.
   - due_date: ISO date string (YYYY-MM-DD) - REQUIRED FOR ALL TASKS. Calculate based on timeline, phase order, and current date. Never return null for due_date.
   ${sowMembers && sowMembers.length > 0 ? `- assignee_id: user_id UUID of the team member to assign this task to. THIS IS MANDATORY - you MUST assign tasks to team members when there is a clear match. Follow these rules:
     * FIRST: Check the phase name for the task's phase_number. Match it to team members whose role_name or role_description aligns with that phase's work type.
     * SECOND: Check the task title for keywords (design, code, test, product, etc.) and match to roles containing those keywords.
     * THIRD: Check the task description to confirm the role match.
     * ONLY assign if ALL THREE criteria match. If no clear match exists, set to null.
     * Use the EXACT UUID from the team members list above, NOT the name.
     * Prefer members with fewer current tasks, avoid overworked members unless they're the only match.
     * IMPORTANT: Most tasks should have an assignee_id - only leave null if there's truly no suitable team member.` : ''}

2. A progress summary (2-3 paragraphs) describing:
   - What has been completed
   - What is currently in progress
   - What remains to be done
   - Overall project health

3. Next steps (array of 3-5 actionable next steps)

4. Blockers (array of any blockers or missing information that would prevent progress)

5. Estimates:
   - total_tasks: Total number of tasks identified
   - estimated_hours: Rough estimate of hours needed
   - estimated_days: Rough estimate of days needed

CRITICAL: Every task in the response MUST include both start_date and due_date fields with valid date strings (YYYY-MM-DD format). Do not omit these fields for any task.

Return your response as JSON in this exact format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "phase_number": 1,
      "priority": "high",
      "status": "todo",
      "estimated_hours": 8.0,
      "tags": ["tag1", "tag2"],
      "start_date": "2024-02-10",
      "due_date": "2024-02-15"${sowMembers && sowMembers.length > 0 ? `,\n      "assignee_id": "${sowMembers[0]?.user_id}" or null (MUST be exact UUID from team members list above, NOT a name)` : ''}
    }
  ],
  "summary": "Progress summary text...",
  "next_steps": ["Step 1", "Step 2"],
  "blockers": ["Blocker 1", "Blocker 2"],
  "estimates": {
    "total_tasks": 25,
    "estimated_hours": 120,
    "estimated_days": 15
  }
}

Focus on actionable, specific tasks that move the project forward. Prioritize tasks based on:
- Phase dependencies (can't do Phase 2 until Phase 1 is complete)
- Critical path items
- High-value, low-effort items first
- Dependencies between tasks

REMINDER: Every task must have both start_date and due_date calculated from the timeline and current date. 
- start_date should be when work begins (typically 1-7 days before due_date depending on task complexity)
- due_date should be when the task should be completed
- Spread tasks out logically across the timeline - don't cluster them all on the same dates.`;

  try {
    const result = await generateStructuredAIResponse<ProjectAnalysisResult>(
      prompt,
      {
        projectData: {
          name: projectName,
          // Optimized: phaseSummaries already uses summarized data (field_count instead of full data)
          phases: phaseSummaries,
        },
      },
      apiKey,
      projectName
    );

    // Handle both wrapped and unwrapped results
    const analysisResult = 'result' in result ? result.result : result;

    // Parse timeline to extract phase durations (for fallback calculation)
    const phaseDurations: Record<number, number> = {};
    let totalDaysFromPhases = 0;
    
    // Parse Phase 1 timeline for early phases (planning phases)
    // Find phases that should use the planning timeline (typically phases before build phases)
    const planningPhases = phases.filter(p => {
      // If we have a phase5Timeline, planning phases are those before the first build phase
      // Otherwise, assume first half of phases are planning
      if (phase5Timeline) {
        // Find the first phase that might be a build phase (check phase name or number)
        const buildPhaseStart = phases.findIndex(p => 
          p.phase_name?.toLowerCase().includes('build') || 
          p.phase_name?.toLowerCase().includes('development') ||
          p.phase_number >= 5
        );
        return buildPhaseStart === -1 || p.phase_number < (buildPhaseStart >= 0 ? phases[buildPhaseStart].phase_number : phases.length);
      }
      // No build timeline - assume first half are planning
      return p.phase_number <= Math.ceil(phases.length / 2);
    });
    
    if (phase1Timeline && planningPhases.length > 0) {
      for (const phase of planningPhases) {
        const phaseMatch = phase1Timeline.match(new RegExp(`[Pp]hase\\s*${phase.phase_number}[\\s:]+(\\d+)\\s*(week|day|month)`, 'i'));
        if (phaseMatch) {
          const duration = parseInt(phaseMatch[1]);
          const unit = phaseMatch[2].toLowerCase();
          if (unit === 'week') {
            phaseDurations[phase.phase_number] = duration * 7;
            totalDaysFromPhases += duration * 7;
          } else if (unit === 'day') {
            phaseDurations[phase.phase_number] = duration;
            totalDaysFromPhases += duration;
          } else if (unit === 'month') {
            phaseDurations[phase.phase_number] = duration * 30;
            totalDaysFromPhases += duration * 30;
          }
        } else {
          // Default: distribute Phase 1 timeline evenly across planning phases
          phaseDurations[phase.phase_number] = (phase1Days || 90) / planningPhases.length;
          totalDaysFromPhases += (phase1Days || 90) / planningPhases.length;
        }
      }
    } else if (planningPhases.length > 0) {
      // No Phase 1 timeline - use defaults
      for (const phase of planningPhases) {
        phaseDurations[phase.phase_number] = 14; // Default 2 weeks per phase
        totalDaysFromPhases += 14;
      }
    }
    
    // Parse Phase 5 timeline for build phases (later phases)
    // Find phases that should use the build timeline
    const buildPhases = phases.filter(p => {
      // Build phases are those after planning phases
      const buildPhaseStart = phases.findIndex(p => 
        p.phase_name?.toLowerCase().includes('build') || 
        p.phase_name?.toLowerCase().includes('development') ||
        p.phase_number >= 5
      );
      if (buildPhaseStart >= 0) {
        return p.phase_number >= phases[buildPhaseStart].phase_number;
      }
      // No clear build phase indicator - assume second half are build
      return p.phase_number > Math.ceil(phases.length / 2);
    });
    
    if (phase5Timeline && buildPhases.length > 0) {
      // Try to parse specific phase durations from timeline
      const parsedPhases = new Set<number>();
      for (const phase of buildPhases) {
        const phaseMatch = phase5Timeline.match(new RegExp(`[Pp]hase\\s*${phase.phase_number}[\\s:]+(\\d+)\\s*(week|day|month)`, 'i'));
        if (phaseMatch) {
          const duration = parseInt(phaseMatch[1]);
          const unit = phaseMatch[2].toLowerCase();
          let days = 0;
          if (unit === 'week') {
            days = duration * 7;
          } else if (unit === 'day') {
            days = duration;
          } else if (unit === 'month') {
            days = duration * 30;
          }
          // Enforce 90 day minimum for first build phase
          if (phase.phase_number === buildPhases[0].phase_number) {
            days = Math.max(days, 90);
          }
          phaseDurations[phase.phase_number] = days;
          totalDaysFromPhases += days;
          parsedPhases.add(phase.phase_number);
        }
      }
      
      // Distribute remaining timeline across phases that weren't specifically parsed
      const unparsedPhases = buildPhases.filter(p => !parsedPhases.has(p.phase_number));
      if (unparsedPhases.length > 0) {
        const remainingDays = effectivePhase5Days - Array.from(parsedPhases).reduce((sum, pn) => sum + (phaseDurations[pn] || 0), 0);
        const daysPerPhase = Math.floor(remainingDays / unparsedPhases.length);
        for (const phase of unparsedPhases) {
          phaseDurations[phase.phase_number] = daysPerPhase;
          totalDaysFromPhases += daysPerPhase;
        }
      } else if (parsedPhases.size === 0) {
        // No specific durations found - distribute evenly
        const daysPerPhase = Math.floor(effectivePhase5Days / buildPhases.length);
        for (const phase of buildPhases) {
          phaseDurations[phase.phase_number] = daysPerPhase;
          totalDaysFromPhases += daysPerPhase;
        }
      }
    } else if (phase5NeedsMinimum && buildPhases.length > 0) {
      // Build phases need timeline but don't have one - use 90 day minimum distributed
      const daysPerPhase = Math.floor(90 / buildPhases.length);
      for (const phase of buildPhases) {
        phaseDurations[phase.phase_number] = daysPerPhase;
        totalDaysFromPhases += daysPerPhase;
      }
    } else if (buildPhases.length > 0) {
      // No Phase 5 timeline and no Phase 5 tasks - use defaults
      phaseDurations[5] = 14;
      phaseDurations[6] = 14;
      totalDaysFromPhases += 28;
    }
    
    // Use total project days if available, otherwise use sum of phases
    const effectiveTotalDays = totalProjectDays || totalDaysFromPhases || 180; // Default to 6 months if nothing found

    // Group tasks by phase for better date distribution
    const tasksByPhase = analysisResult.tasks.reduce((acc, task) => {
      const phase = task.phase_number || 1;
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(task);
      return acc;
    }, {} as Record<number, typeof analysisResult.tasks>);

    // Ensure all tasks have required fields
    const validatedTasks = analysisResult.tasks.map((task, index) => {
      // Parse start_date if provided
      let startDate: string | null = null;
      if (task.start_date) {
        try {
          const date = new Date(task.start_date);
          if (!isNaN(date.getTime())) {
            startDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          logger.warn(`Invalid start_date for task "${task.title}": ${task.start_date}`);
        }
      }

      // Parse due_date if provided
      let dueDate: string | null = null;
      if (task.due_date) {
        try {
          // Validate and format the date
          const date = new Date(task.due_date);
          if (!isNaN(date.getTime())) {
            dueDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
          }
        } catch (e) {
          logger.warn(`Invalid due_date for task "${task.title}": ${task.due_date}`);
        }
      }
      
      // If no due_date was provided OR if date seems invalid, calculate based on timeline
      const today = new Date();
      const phaseNumber = task.phase_number || 1;
      
      if (!dueDate) {
        // Calculate phase start offset based on timeline structure
        let phaseStartOffset = 0;
        
        if (Object.keys(phaseDurations).length > 0) {
          // Use actual phase durations if available
          for (let prevPhase = 1; prevPhase < phaseNumber; prevPhase++) {
            phaseStartOffset += phaseDurations[prevPhase] || 0;
          }
        } else {
          // Fallback: distribute evenly
          const daysPerPhase = effectiveTotalDays / 6;
          phaseStartOffset = (phaseNumber - 1) * daysPerPhase;
        }
        
        // Calculate task offset within phase (spread tasks across phase duration)
        const phaseDuration = phaseDurations[phaseNumber] || (effectiveTotalDays / 6);
        const tasksInPhase = tasksByPhase[phaseNumber] || [];
        const taskIndexInPhase = tasksInPhase.findIndex((t) => t.title === task.title);
        const taskOffset = tasksInPhase.length > 1 
          ? Math.floor((taskIndexInPhase / Math.max(1, tasksInPhase.length - 1)) * (phaseDuration - 1))
          : 0;
        
        const defaultDate = new Date(today);
        defaultDate.setDate(today.getDate() + Math.floor(phaseStartOffset) + taskOffset + 1);
        dueDate = defaultDate.toISOString().split('T')[0];
        logger.warn(`Task "${task.title}" (Phase ${phaseNumber}) ${task.due_date ? 'had invalid' : 'had no'} due_date from AI, calculated from timeline (Phase 1: ${phase1Days || 0} days, Phase 5: ${effectivePhase5Days} days, Total: ${effectiveTotalDays} days): ${dueDate}`);
      } else {
        // Validate that the date makes sense (not too far in the past or future)
        const providedDate = new Date(dueDate);
        const daysFromToday = Math.floor((providedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // If date is more than 2 years in the past or more than 3 years in the future, recalculate
        if (daysFromToday < -730 || daysFromToday > 1095) {
          logger.warn(`Task "${task.title}" has unrealistic due_date: ${dueDate} (${daysFromToday} days from today), recalculating...`);
          // Recalculate using the same logic as above
          let phaseStartOffset = 0;
          
          if (Object.keys(phaseDurations).length > 0) {
            for (let prevPhase = 1; prevPhase < phaseNumber; prevPhase++) {
              phaseStartOffset += phaseDurations[prevPhase] || 0;
            }
          } else {
            const daysPerPhase = effectiveTotalDays / 6;
            phaseStartOffset = (phaseNumber - 1) * daysPerPhase;
          }
          
          const phaseDuration = phaseDurations[phaseNumber] || (effectiveTotalDays / 6);
          const tasksInPhase = tasksByPhase[phaseNumber] || [];
          const taskIndexInPhase = tasksInPhase.findIndex((t) => t.title === task.title);
          const taskOffset = tasksInPhase.length > 1 
            ? Math.floor((taskIndexInPhase / Math.max(1, tasksInPhase.length - 1)) * (phaseDuration - 1))
            : 0;
          
          const recalculatedDate = new Date(today);
          recalculatedDate.setDate(today.getDate() + Math.floor(phaseStartOffset) + taskOffset + 1);
          dueDate = recalculatedDate.toISOString().split('T')[0];
          logger.warn(`Recalculated to: ${dueDate}`);
        }
      }

      // Calculate start_date if not provided
      if (!startDate && dueDate) {
        // Default: start_date is 3-5 days before due_date (depending on priority)
        const dueDateObj = new Date(dueDate);
        const daysBefore = task.priority === 'critical' ? 2 : task.priority === 'high' ? 3 : task.priority === 'medium' ? 4 : 5;
        const startDateObj = new Date(dueDateObj);
        startDateObj.setDate(dueDateObj.getDate() - daysBefore);
        
        // Ensure start_date is not before today
        if (startDateObj < today) {
          startDateObj.setTime(today.getTime());
        }
        
        startDate = startDateObj.toISOString().split('T')[0];
      } else if (!startDate) {
        // If no due_date either, calculate both
        if (!dueDate) {
          // This should not happen due to validation above, but just in case
          const defaultDueDate = new Date(today);
          defaultDueDate.setDate(today.getDate() + 7);
          dueDate = defaultDueDate.toISOString().split('T')[0];
        }
        const dueDateObj = new Date(dueDate);
        const daysBefore = task.priority === 'critical' ? 2 : task.priority === 'high' ? 3 : task.priority === 'medium' ? 4 : 5;
        const startDateObj = new Date(dueDateObj);
        startDateObj.setDate(dueDateObj.getDate() - daysBefore);
        if (startDateObj < today) {
          startDateObj.setTime(today.getTime());
        }
        startDate = startDateObj.toISOString().split('T')[0];
      }

      // Ensure start_date is not after due_date
      if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
        // Set start_date to 1 day before due_date
        const dueDateObj = new Date(dueDate);
        const startDateObj = new Date(dueDateObj);
        startDateObj.setDate(dueDateObj.getDate() - 1);
        startDate = startDateObj.toISOString().split('T')[0];
      }
      
      return {
        ...task,
        project_id: '', // Will be set by caller
        phase_number: task.phase_number || null,
        title: task.title || 'Untitled Task',
        description: task.description || null,
        status: (task.status || 'todo') as ProjectTask['status'],
        priority: (task.priority || 'medium') as ProjectTask['priority'],
        assignee_id: task.assignee_id || null, // Use AI-suggested assignee if provided
        start_date: startDate,
        due_date: dueDate,
        estimated_hours: task.estimated_hours || null,
        tags: task.tags || [],
        notes: null,
        dependencies: [],
        ai_generated: true,
        ai_analysis_id: null, // Will be set by caller
      };
    });

    // Validate that all tasks have dates
    const tasksWithoutDates = validatedTasks.filter((t) => !t.due_date || !t.start_date);
    if (tasksWithoutDates.length > 0) {
      logger.warn(`[Project Analyzer] ${tasksWithoutDates.length} tasks are missing dates after validation`);
      tasksWithoutDates.forEach((task) => {
        logger.warn(`  - "${task.title}" (Phase ${task.phase_number}): start_date=${task.start_date || 'MISSING'}, due_date=${task.due_date || 'MISSING'}`);
      });
    }

    // Log date distribution
    const tasksByPhaseForLogging = validatedTasks.reduce((acc, task) => {
      const phase = task.phase_number || 0;
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(task);
      return acc;
    }, {} as Record<number, typeof validatedTasks>);

    logger.debug('[Project Analyzer] Task date distribution:');
    logger.debug(`  Total project duration: ${effectiveTotalDays} days (${Math.round(effectiveTotalDays / 30)} months)`);
    logger.debug(`  Phase 1 timeline: ${phase1Timeline || 'Not provided'}`);
    logger.debug(`  Phase 5 timeline: ${phase5Timeline || 'Not provided'}`);
    logger.debug(`  Phase 1 duration: ${phase1Days || 0} days`);
    logger.debug(`  Phase 5 duration: ${effectivePhase5Days} days (minimum 90 days for full scale build)`);
    Object.keys(tasksByPhaseForLogging).forEach((phase) => {
      const phaseTasks = tasksByPhaseForLogging[parseInt(phase)];
      const startDates = phaseTasks
        .map((t) => t.start_date)
        .filter(Boolean)
        .sort();
      const dueDates = phaseTasks
        .map((t) => t.due_date)
        .filter(Boolean)
        .sort();
      logger.debug(`  Phase ${phase}: ${phaseTasks.length} tasks, start dates from ${startDates[0] || 'N/A'} to ${startDates[startDates.length - 1] || 'N/A'}, due dates from ${dueDates[0] || 'N/A'} to ${dueDates[dueDates.length - 1] || 'N/A'}`);
    });

    return {
      ...analysisResult,
      tasks: validatedTasks,
    };
  } catch (error) {
    logger.error('[Project Analyzer] Error analyzing project:', error);
    throw new Error(
      `Failed to analyze project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Smart merge existing tasks with new AI-generated tasks
 * - Update existing tasks if they match (by title similarity)
 * - Add new tasks
 * - Archive completed tasks that are no longer relevant
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

  // Simple title similarity matching (can be enhanced with fuzzy matching)
  const findMatchingTask = (newTask: { title: string }) => {
    const normalizedNewTitle = newTask.title.toLowerCase().trim();
    return existingTasks.find((existing) => {
      const normalizedExistingTitle = existing.title.toLowerCase().trim();
      // Check for exact match or high similarity
      if (normalizedExistingTitle === normalizedNewTitle) {
        return true;
      }
      // Check if one contains the other (for slight variations)
      if (
        normalizedExistingTitle.includes(normalizedNewTitle) ||
        normalizedNewTitle.includes(normalizedExistingTitle)
      ) {
        return true;
      }
      return false;
    });
  };

  // Process new tasks
  for (const newTask of newTasks) {
    const matching = findMatchingTask(newTask);
    if (matching) {
      // Update existing task, but preserve manual edits (status, assignee, notes)
      // Only update AI-generated fields if task was AI-generated
      // Always update due_date if new task has one (to sync with timeline)
      if (matching.ai_generated) {
        // For re-analyze: append new insights to notes if description changed
        const existingNotes = matching.notes || '';
        const timestamp = new Date().toISOString().split('T')[0];
        let updatedNotes = existingNotes;
        
        // If description changed, append update to notes
        if (newTask.description !== matching.description) {
          const newNote = `\n\n---\n[${timestamp}] Re-analysis update: ${newTask.description}`;
          updatedNotes = existingNotes + newNote;
        }
        
        toUpdate.push({
          ...matching,
          title: newTask.title,
          description: newTask.description,
          phase_number: newTask.phase_number,
          priority: newTask.priority,
          tags: newTask.tags,
          // Always use new dates if provided (to sync with timeline), otherwise keep existing
          start_date: newTask.start_date || matching.start_date,
          due_date: newTask.due_date || matching.due_date,
          // Preserve existing assignee_id - don't overwrite if task already has an assignee
          assignee_id: matching.assignee_id || newTask.assignee_id || null,
          // Append to notes field for re-analysis tracking
          notes: updatedNotes,
          ai_analysis_id: aiAnalysisId,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Even if task is not AI-generated, update dates if new task has them and existing doesn't
        // This ensures timeline sync works for manually created tasks too
        if ((newTask.due_date && !matching.due_date) || (newTask.start_date && !matching.start_date)) {
          toUpdate.push({
            ...matching,
            start_date: newTask.start_date || matching.start_date,
            due_date: newTask.due_date || matching.due_date,
            updated_at: new Date().toISOString(),
          });
        }
      }
    } else {
      // New task - add it
      toInsert.push({
        ...newTask,
        ai_analysis_id: aiAnalysisId,
      });
    }
  }

  // Archive completed tasks that are no longer in the new task list
  // Only archive if they were AI-generated and are done
  for (const existing of existingTasks) {
    if (existing.ai_generated && existing.status === 'done') {
      const stillRelevant = newTasks.some((newTask) => {
        const normalizedNew = newTask.title.toLowerCase().trim();
        const normalizedExisting = existing.title.toLowerCase().trim();
        return (
          normalizedNew === normalizedExisting ||
          normalizedNew.includes(normalizedExisting) ||
          normalizedExisting.includes(normalizedNew)
        );
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

