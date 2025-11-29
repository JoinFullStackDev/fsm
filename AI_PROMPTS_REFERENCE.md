# AI Prompts Reference

This document lists all AI prompts used in the system for fine-tuning and refinement.

---

## 1. Project Analysis Prompt
**Location:** `lib/ai/projectAnalyzer.ts` (line ~267)
**Purpose:** Analyzes a project and generates tasks, summary, blockers, and estimates

```typescript
You are analyzing a project called "${projectName}" that uses The FullStack Method™ framework.

The project has ${phases.length} phase${phases.length !== 1 ? 's' : ''}:
${phaseList}

Current Phase Status:
${JSON.stringify(phaseSummaries, null, 2)}

${existingTasks.length > 0 ? `Existing Tasks:\n${JSON.stringify(existingTasksSummary, null, 2)}` : 'No existing tasks.'}

${combinedTimeline ? `\n\n=== CRITICAL: TIMELINE-BASED DATE ASSIGNMENT ===
Timeline Information:
${phase1Timeline ? `Phase 1 (Planning Phases 1-4) Timeline: ${phase1Timeline}` : 'No Phase 1 timeline provided.'}
${phase5Timeline ? `Phase 5 (Build Phases 5-6) Timeline: ${phase5Timeline}` : 'No Phase 5 build timeline provided.'}
${phase5NeedsMinimum && !phase5Days ? 'Note: Phase 5 (Build Accelerator) will use minimum 90 days for full scale build.' : ''}

Current date (TODAY): ${new Date().toISOString().split('T')[0]}
${totalProjectDays ? `Total Project Duration: ${totalProjectDays} days (approximately ${Math.round(totalProjectDays / 30)} months)
  - Planning Phases (1-4): ${phase1Days || 0} days
  - Build Phases (5-6): ${effectivePhase5Days} days (minimum 90 days for full scale build)` : 'Could not parse total project duration from timelines.'}
${highestCompletedPhase > 0 ? `Project Status: Phases 1-${highestCompletedPhase} are COMPLETED. Currently working on Phase ${currentPhase?.phase_number || highestCompletedPhase + 1}.` : 'Project Status: Just starting - Phase 1 is the first phase.'}

YOU MUST ASSIGN A due_date (YYYY-MM-DD format) TO EVERY SINGLE TASK. NO EXCEPTIONS. THIS IS MANDATORY.

Date Assignment Rules:
1. TOTAL project duration = Phase 1 timeline + Phase 5 timeline:
   - Phase 1 timeline covers early planning phases
   - Phase 5 timeline covers build/development phases
   - Phase 5 (Build Accelerator) should be at least 90 days for full scale builds
   - If Phase 5 timeline is less than 90 days, use 90 days minimum
   - If Phase 5 timeline doesn't exist but Phase 5 has tasks/data, default to 90 days
   - IMPORTANT: This project has ${phases.length} phases total. You MUST generate tasks for ALL ${phases.length} phases: ${phases.map(p => `Phase ${p.phase_number} (${p.phase_name || `Phase ${p.phase_number}`})`).join(', ')}.

2. Calculate dates based on:
   - Start date: ${new Date().toISOString().split('T')[0]} (TODAY - this is when work begins)
   - End date: ${totalProjectDays ? new Date(Date.now() + totalProjectDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 'Calculate from timeline'}
   - Total duration: ${totalProjectDays || 'Parse from timeline'} days
   - Planning phases: ${phase1Days || 0} days
   - Build phases: ${effectivePhase5Days} days
   - Project status: ${highestCompletedPhase > 0 ? `Phases 1-${highestCompletedPhase} are done` : 'Starting fresh'}

3. DISTRIBUTE TASKS across the timeline for ALL ${phases.length} phases:
   - Early phases (typically 1-4): Distribute across Phase 1 timeline duration (${phase1Days || 'parse from Phase 1 timeline'} days)
   - Build phases (typically 5+): Distribute across Phase 5 timeline duration (${effectivePhase5Days} days minimum)
   - Each phase should have multiple tasks (typically 3-8 tasks per phase depending on complexity)
   - Build phase tasks should start AFTER planning phases completion
   - Space tasks evenly across each phase's portion of the timeline
   - Tasks should be 2-5 days apart (not all on the same day)
   - CRITICAL: Generate tasks for phases ${phases.map(p => p.phase_number).join(', ')} - DO NOT skip any phases

4. Phase distribution example:
   - Planning timeline: ${phase1Days || 90} days (covers early phases)
   - Build timeline: ${effectivePhase5Days} days (covers build phases, minimum 90 days)
   - Total: ${totalProjectDays} days
   - Early phase tasks: Days 1-${phase1Days || 90}
   - Build phase tasks: Days ${(phase1Days || 90) + 1}-${totalProjectDays}

5. ${highestCompletedPhase > 0 ? `IMPORTANT: Since phases 1-${highestCompletedPhase} are completed, calculate where we are in the timeline and assign dates accordingly. Completed phase tasks should have dates in the past or very near future.` : 'All phases are upcoming - assign dates starting from today forward.'}

6. EVERY task in your response MUST include: "due_date": "YYYY-MM-DD"
   - Never return null
   - Never omit the field
   - Always use valid date format
   - Calculate based on TODAY + appropriate offset based on phase and timeline
   - Build phase tasks must account for the build timeline (minimum 90 days)
   
7. CRITICAL REQUIREMENT: Generate tasks for ALL ${phases.length} phases listed above. Do not limit yourself to only phases 1-6. This project has phases: ${phases.map(p => `${p.phase_number}. ${p.phase_name || `Phase ${p.phase_number}`}`).join(', ')}. Each phase should have multiple relevant tasks.

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

Based on the phase data provided, generate:
1. A comprehensive task list organized by phase. CRITICAL: You MUST generate tasks for ALL ${phases.length} phases listed above (${phases.map(p => `Phase ${p.phase_number}: ${p.phase_name || `Phase ${p.phase_number}`}`).join(', ')}). Each phase should have multiple tasks (typically 3-8 tasks per phase). Do not limit yourself to only the first few phases. Each task MUST have:
   - title: Clear, actionable task title
   - description: Detailed description of what needs to be done
   - phase_number: Which phase this task belongs to (must be one of: ${phases.map(p => p.phase_number).join(', ')})
   - priority: 'low', 'medium', 'high', or 'critical'
   - status: 'todo' (for new tasks) or match existing status if task already exists
   - tags: Array of relevant tags (e.g., ['frontend', 'backend', 'design', 'testing'])
   - start_date: ISO date string (YYYY-MM-DD) - REQUIRED FOR ALL TASKS. The date when work should begin on this task. Should be before or equal to due_date.
   - due_date: ISO date string (YYYY-MM-DD) - REQUIRED FOR ALL TASKS. Calculate based on timeline, phase order, and current date. Never return null for due_date.

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
      "tags": ["tag1", "tag2"],
      "start_date": "2024-02-10",
      "due_date": "2024-02-15"
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
- Spread tasks out logically across the timeline - don't cluster them all on the same dates.
```

---

## 2. Timeline Extraction Prompt (for Custom Templates)
**Location:** `lib/ai/projectAnalyzer.ts` (line ~89)
**Purpose:** Extracts timeline information from custom template phase content

```typescript
You are analyzing project phase content to extract timeline and duration information.

Phase Content:
${phaseContent.join('\n\n')}

Please extract any timeline, duration, or date information from the above content. Look for:
- Project timelines (e.g., "3 months", "6 months", "1 year")
- Phase durations (e.g., "Phase 1: 2 weeks", "Phase 2: 1 month")
- Planning phase timelines (phases 1-4)
- Build phase timelines (phases 5-6 or development/implementation phases)
- Specific dates or deadlines
- Duration estimates in weeks, months, days, or years

Return your response as JSON in this format:
{
  "planning_timeline": "extracted planning timeline text or empty string",
  "build_timeline": "extracted build/development timeline text or empty string",
  "overall_timeline": "extracted overall project timeline if found or empty string"
}

If no timeline information is found, return empty strings. Be thorough - search through all the content, not just obvious fields.
```

---

## 3. Task Generation from Prompt/PRD
**Location:** `lib/ai/taskGenerator.ts` (line ~89)
**Purpose:** Generates tasks from user-provided prompts or PRDs

```typescript
You are generating tasks for a project called "${projectName}" using The FullStack Method™ framework.

User Input/Prompt:
${prompt}
${context ? `\nAdditional Context:\n${context}` : ''}

Project Phases Available:
${phaseList}

${existingTasksContext}

Generate a comprehensive list of tasks based on the user's input. Each task should have:
- title: Clear, actionable task title
- description: Detailed description of what needs to be done
- phase_number: Which phase this task belongs to (must be one of: ${phases.map((p) => p.phase_number).join(', ')})
- priority: 'low', 'medium', 'high', or 'critical'
- status: 'todo' (for new tasks)
- tags: Array of relevant tags
- requirements: Array of specific requirements for this task (extracted from the prompt)
- userStories: Array of user stories if mentioned in the prompt (optional)
- notes: Additional notes or context

IMPORTANT: Extract dates from the user input. If dates are mentioned:
- Set due_date to the earliest date found
- If multiple dates are mentioned, use the earliest one
- If no dates are found, set due_date to null (user can set it later)
- Calculate relative dates from today: ${new Date().toISOString().split('T')[0]}

Return your response as JSON in this exact format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "phase_number": 1,
      "priority": "high",
      "status": "todo",
      "tags": ["tag1", "tag2"],
      "requirements": ["Requirement 1", "Requirement 2"],
      "userStories": ["As a user, I want..."],
      "notes": "Additional notes",
      "due_date": "2025-03-15" or null
    }
  ],
  "summary": "Brief summary of generated tasks"
}

Focus on actionable, specific tasks that directly address the user's prompt.
```

---

## 4. Date Extraction Prompt
**Location:** `lib/ai/taskGenerator.ts` (line ~33)
**Purpose:** Extracts dates and deadlines from text

```typescript
Extract all dates and deadlines from the following text. Look for:
- Specific dates: "March 15th", "2025-02-12", "December 31, 2024"
- Relative dates: "in 2 weeks", "end of quarter", "next month"
- Implied dates: "before design review in June", "after the meeting next week"

Text: "${text}"

Return a JSON object with:
{
  "dates": ["2025-03-15", "2025-06-30", ...],  // Array of ISO date strings (YYYY-MM-DD)
  "earliest": "2025-03-15"  // The earliest date found, or null if none
}

If no dates are found, return: { "dates": [], "earliest": null }
If relative dates are found, calculate them from today's date: ${new Date().toISOString().split('T')[0]}
```

---

## 5. Task Similarity Comparison Prompt
**Location:** `lib/ai/taskSimilarity.ts` (line ~103)
**Purpose:** Determines semantic similarity between two tasks to detect duplicates

```typescript
Compare these two tasks and determine how similar they are semantically (meaning, not just wording).

Task 1:
Title: ${task1.title}
Description: ${task1.description || 'No description'}

Task 2:
Title: ${task2.title}
Description: ${task2.description || 'No description'}

Rate their similarity on a scale of 0.0 to 1.0 where:
- 1.0 = Exactly the same task (duplicate)
- 0.9-0.99 = Very similar, likely the same task with different wording
- 0.7-0.89 = Similar tasks, possibly related but not duplicates
- 0.5-0.69 = Somewhat related but different tasks
- 0.0-0.49 = Different tasks

Return ONLY a JSON object with this format:
{
  "similarity": 0.85,
  "reason": "Brief explanation"
}
```

---

## 6. Template Generation Prompt
**Location:** `app/api/admin/templates/generate/route.ts` (line ~83)
**Purpose:** Generates project management templates with phases and fields

```typescript
You are an expert at creating project management templates. Based on the user's requirements, generate a complete template structure with phases and fields.

IMPORTANT: You must respond with ONLY valid JSON. Do not include any markdown code blocks, explanations, or additional text. Start your response directly with the opening brace { and end with the closing brace }.

User Requirements:
Template Name: ${name}
Description: ${description}
${category ? `Category: ${category}` : ''}

Your task is to generate a JSON structure with:
1. Template metadata (name, description, category)
2. Phases array - each phase should have:
   - phase_number: sequential number starting from 1
   - phase_name: descriptive name (e.g., "Discovery", "Design", "Development", "Launch")
   - display_order: same as phase_number
3. Field configurations array - each field should have:
   - phase_number: which phase this field belongs to
   - field_key: unique kebab-case identifier (e.g., "problem_statement", "target_users")
   - field_type: one of: text, textarea, array, select, checkbox, table, custom
   - display_order: order within the phase (starting from 1)
   - layout_config: { columns: 12 (full width) or 6 (half width), spacing: 2 }
   - field_config: {
       label: human-readable label
       helpText: helpful description (optional but recommended)
       placeholder: example text (optional)
       required: boolean
       aiSettings: { enabled: true } for fields that could benefit from AI assistance
     }

Field Type Guidelines:
- Use "text" for short single-line inputs (names, titles, short answers)
- Use "textarea" for longer multi-line text (descriptions, notes, explanations)
- Use "array" for lists of items (target users, features, requirements)
- Use "select" for dropdown choices (status, priority, category)
- Use "checkbox" for yes/no or boolean values
- Use "table" for structured data with rows and columns
- Use "custom" for complex structured data (API specs, ERD diagrams)

Best Practices:
- Create 3-6 phases that logically progress through the project lifecycle
- Each phase should have 3-8 relevant fields
- Phase names should be clear and action-oriented
- Field labels should be concise but descriptive
- Include helpText to guide users on what to enter
- Mark critical fields as required
- Enable AI settings for fields that would benefit from AI assistance
- Use appropriate field types based on the data being collected

Generate a comprehensive template that covers the full project lifecycle based on the user's description. Be creative but practical.

Respond ONLY with valid JSON matching this exact structure:
{
  "template": {
    "name": "${name}",
    "description": "...",
    "category": "${category || ''}"
  },
  "phases": [
    {
      "phase_number": 1,
      "phase_name": "...",
      "display_order": 1
    }
  ],
  "fields": [
    {
      "phase_number": 1,
      "field_key": "...",
      "field_type": "...",
      "display_order": 1,
      "layout_config": { "columns": 12, "spacing": 2 },
      "field_config": {
        "label": "...",
        "helpText": "...",
        "placeholder": "...",
        "required": true,
        "aiSettings": { "enabled": true }
      }
    }
  ]
}
```

---

## 7. Weekly Report Generation Prompt
**Location:** `lib/reports/aiReportGenerator.ts` (line ~29)
**Purpose:** Generates weekly project reports

```typescript
You are a project management analyst. Generate a comprehensive weekly report for the project "${projectName}".

**Last Week (${lastWeekRange}):**
- Total tasks: ${data.lastWeek.total}
- Completed: ${data.lastWeek.completed}
- In Progress: ${data.lastWeek.inProgress}
- Blocked: ${data.lastWeek.blocked}
- Overdue: ${data.lastWeek.overdue}
${data.lastWeek.completedTasks.length > 0 ? `\nCompleted Tasks:\n${data.lastWeek.completedTasks.map(t => `- ${t.title} (${t.priority} priority)${t.assignee ? ` - Assigned to ${t.assignee}` : ''}`).join('\n')}` : ''}
${data.lastWeek.activeTasks.length > 0 ? `\nActive Tasks:\n${data.lastWeek.activeTasks.map(t => `- ${t.title} (${t.priority} priority${t.due_date ? `, due ${t.due_date}` : ''})${t.assignee ? ` - Assigned to ${t.assignee}` : ''}`).join('\n')}` : ''}

**This Week (${thisWeekRange}):**
- Total tasks: ${data.thisWeek.total}
- Planned: ${data.thisWeek.planned}
- In Progress: ${data.thisWeek.inProgress}
${data.thisWeek.upcomingTasks.length > 0 ? `\nUpcoming Tasks:\n${data.thisWeek.upcomingTasks.map(t => `- ${t.title} (${t.priority} priority${t.due_date ? `, due ${t.due_date}` : ''})${t.assignee ? ` - Assigned to ${t.assignee}` : ''}`).join('\n')}` : ''}

**Team Members:** ${projectMembers.map((m) => m.name || 'Unknown').join(', ')}

Generate a professional weekly report with:
1. Executive Summary (4-5 sentences that MUST include specific task names. Start by listing 3-5 key completed tasks from last week by name, then list 3-5 key upcoming tasks for this week by name. Include their priorities and due dates when available. Example: "Last week we completed 'Design User Interface Mockups' (high priority) and 'Set Up Development Environment' (medium priority). This week, we're focusing on 'Implement Authentication System' (due Dec 15, high priority) and 'Create Database Schema' (due Dec 18, medium priority).")
2. Key Insights (3-5 bullet points highlighting important observations)
3. Risks (identify any blockers, overdue tasks, or potential issues)
4. Recommendations (actionable next steps)
5. Team Workload Analysis (analyze workload distribution and identify any team members who may be overloaded)

IMPORTANT: The executive summary MUST include actual task names from the lists above. Do not use generic phrases like "12 tasks" - instead name specific tasks.

Format your response as JSON with this structure:
{
  "executiveSummary": "...",
  "keyInsights": ["...", "..."],
  "risks": ["...", "..."],
  "recommendations": ["...", "..."],
  "teamWorkload": "..."
}
```

---

## 8. Monthly Report Generation Prompt
**Location:** `lib/reports/aiReportGenerator.ts` (line ~123)
**Purpose:** Generates monthly project reports

```typescript
You are a project management analyst. Generate a comprehensive monthly report for the project "${projectName}" for ${monthRange}.

**Month Summary:**
- Total tasks: ${data.total}
- Completed: ${data.completed}
- In Progress: ${data.inProgress}
- Blocked: ${data.blocked}
- Overdue: ${data.overdue}
${data.completedTasks.length > 0 ? `\nCompleted Tasks This Month:\n${data.completedTasks.map(t => `- ${t.title} (${t.priority} priority)${t.assignee ? ` - Assigned to ${t.assignee}` : ''}`).join('\n')}` : ''}
${data.activeTasks.length > 0 ? `\nCurrently Active Tasks:\n${data.activeTasks.map(t => `- ${t.title} (${t.priority} priority${t.due_date ? `, due ${t.due_date}` : ''})${t.assignee ? ` - Assigned to ${t.assignee}` : ''}`).join('\n')}` : ''}
${data.blockedTasks.length > 0 ? `\nBlocked Tasks:\n${data.blockedTasks.map(t => `- ${t.title}${t.assignee ? ` - Assigned to ${t.assignee}` : ''}`).join('\n')}` : ''}
${data.overdueTasks.length > 0 ? `\nOverdue Tasks:\n${data.overdueTasks.map(t => `- ${t.title} (due ${t.due_date})${t.assignee ? ` - Assigned to ${t.assignee}` : ''}`).join('\n')}` : ''}

**Team Members:** ${projectMembers.map((m) => m.name || 'Unknown').join(', ')}

Generate a professional monthly report with:
1. Executive Summary (5-6 sentences that MUST include specific task names. Start by listing 4-6 key completed tasks from this month by name with their priorities, then list 4-6 key active tasks by name with their priorities and due dates. Example: "This month we completed 'Build User Authentication' (high priority), 'Design Dashboard UI' (medium priority), and 'Set Up CI/CD Pipeline' (high priority). Currently active tasks include 'Implement Payment Processing' (due Dec 20, high priority) and 'Create Admin Panel' (due Dec 25, medium priority).")
2. Key Insights (4-6 bullet points highlighting achievements and challenges)
3. Risks (identify blockers, trends, or concerns)
4. Recommendations (strategic next steps for the coming month)
5. Team Workload Analysis (analyze team performance and workload distribution)

IMPORTANT: The executive summary MUST include actual task names from the lists above. Do not use generic phrases like "15 tasks" - instead name specific tasks.

Format your response as JSON with this structure:
{
  "executiveSummary": "...",
  "keyInsights": ["...", "..."],
  "risks": ["...", "..."],
  "recommendations": ["...", "..."],
  "teamWorkload": "..."
}
```

---

## 9. Forecast Report Generation Prompt
**Location:** `lib/reports/aiReportGenerator.ts` (line ~217)
**Purpose:** Generates forecast reports for future periods

```typescript
You are a project management analyst. Generate a comprehensive forecast report for the project "${projectName}" for the next ${data.period.days} days (${periodRange}).

**Current Status:**
- Total tasks: ${data.total}
- Completed: ${data.completed}
- In Progress: ${data.inProgress}
- Planned: ${data.planned}
- Blocked: ${data.blocked}

**Upcoming Tasks (Next ${data.period.days} days):**
${data.upcomingTasks.length > 0 ? data.upcomingTasks.map(t => `- ${t.title} (${t.priority} priority${t.due_date ? `, due ${t.due_date}` : ''})${t.assignee ? ` - Assigned to ${t.assignee}` : ''}`).join('\n') : 'No upcoming tasks'}

**Team Members:** ${projectMembers.map((m) => m.name || 'Unknown').join(', ')}

Generate a professional forecast report with:
1. Executive Summary (4-5 sentences focusing on what's planned for the next period)
2. Key Milestones (identify important deadlines and milestones)
3. Resource Planning (analyze team capacity and workload)
4. Risk Assessment (identify potential blockers or concerns)
5. Recommendations (suggestions for optimizing the forecast period)

Format your response as JSON with this structure:
{
  "executiveSummary": "...",
  "keyMilestones": ["...", "..."],
  "resourcePlanning": "...",
  "riskAssessment": ["...", "..."],
  "recommendations": ["...", "..."]
}
```

---

## 10. Cursor Master Prompt Generation
**Location:** `lib/exportHandlers/cursorBundle.ts` (line ~29)
**Purpose:** Generates comprehensive master prompts for Cursor AI code generation

**Note:** This is a very long prompt (200+ lines). See the file for the complete prompt structure.

---

## Summary

All prompts are located in:
- `lib/ai/projectAnalyzer.ts` - Project analysis and timeline extraction
- `lib/ai/taskGenerator.ts` - Task generation and date extraction
- `lib/ai/taskSimilarity.ts` - Task duplicate detection
- `app/api/admin/templates/generate/route.ts` - Template generation
- `lib/reports/aiReportGenerator.ts` - Weekly, monthly, and forecast reports
- `lib/exportHandlers/cursorBundle.ts` - Cursor master prompt generation

Each prompt can be refined independently to improve AI output quality.

