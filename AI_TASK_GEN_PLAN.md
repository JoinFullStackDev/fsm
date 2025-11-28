AI Task Generator Add-On Implementation Plan
Overview
Build a production-grade AI Task Generator that creates tasks from user input (PRD, spec, prompt) with intelligent date extraction, duplicate detection, merge capabilities, and a preview/audit interface before committing tasks to the database.

Architecture
Backend API Endpoints
1. Preview Generation Endpoint

Path: `POST /api/projects/[id]/generate-tasks/preview`
Purpose: Generate tasks from user input, extract dates, detect duplicates, return preview data
Request: { prompt: string, context?: string }
Response: { tasks: PreviewTask[] } where PreviewTask includes duplicateStatus, existingTaskId, etc.
Location: `app/api/projects/[id]/generate-tasks/preview/route.ts`
2. Task Injection Endpoint

Path: `POST /api/projects/[id]/generate-tasks/inject`
Purpose: Create/merge tasks based on user selections from preview
Request: { tasks: TaskInjection[], merges: TaskMerge[] }
Response: { created: number, merged: number, errors?: string[] }
Location: `app/api/projects/[id]/generate-tasks/inject/route.ts`
Backend Services
1. AI Task Generator Service

File: lib/ai/taskGenerator.ts
Functions:
generateTasksFromPrompt(prompt, projectContext, phases, existingTasks, apiKey): Main generation function
extractDatesFromText(text): Extract dates using AI (specific dates, relative dates, implied dates)
Returns tasks with dueDate populated when dates are found
2. Similarity Detection Service

File: lib/ai/taskSimilarity.ts
Functions:
detectDuplicates(newTasks, existingTasks): Hybrid approach
calculateStringSimilarity(task1, task2): String-based similarity (Levenshtein, Jaccard)
calculateSemanticSimilarity(task1, task2, apiKey): AI embedding-based similarity
Returns duplicateStatus: "unique" | "possible-duplicate" | "exact-duplicate" and existingTaskId if match found
3. Task Merge Service

File: lib/ai/taskMerger.ts
Functions:
mergeTaskContent(existingTask, aiTask): Merges description, requirements (from notes), notes, due date (only if existing doesn't have one)
Handles merging requirements array stored in notes field
Type Definitions
File: types/taskGenerator.ts

PreviewTask: Extends ProjectTask with duplicateStatus, existingTaskId, requirements (array)
TaskInjection: Task to be created (with selection flag)
TaskMerge: Merge operation specification
DuplicateStatus: Type union for duplicate status
Frontend Components
1. Task Generator Modal

File: components/project-management/TaskGeneratorModal.tsx
Features:
Input field for PRD/prompt
"Generate Preview" button
Shows loading state during generation
Opens Preview Table when ready
2. Task Preview Table

File: components/project-management/TaskPreviewTable.tsx
Features:
Table with columns: Select, Title, Description (truncated), Requirements (icon → modal), Notes (icon → tooltip), Phase, Due Date, Duplicate Status Badge, Merge Action
Bulk select checkbox
Remove selected button
Color coding: Green (unique), Yellow (possible duplicate), Red (exact duplicate)
Merge dialog for duplicate tasks
3. Task Merge Dialog

File: components/project-management/TaskMergeDialog.tsx
Features:
Side-by-side comparison of new vs existing task
Highlight differences
Options: Merge, Keep Both, Discard AI Task
Shows what will be merged (description, requirements, notes, due date)
4. Requirements Modal

File: components/project-management/RequirementsModal.tsx
Features:
Displays requirements array from task notes
Read-only view (requirements come from AI generation)
Integration Points
1. Task Management Page

File: `app/project-management/[id]/page.tsx`
Changes:
Add "Generate Tasks with AI" button in header/toolbar
Opens TaskGeneratorModal
After injection, refresh task list
Activity Logging
File: lib/utils/activityLogger.ts (new or extend existing)

logTaskMerged(projectId, taskId, userId): Log merge operations
logTasksGenerated(projectId, count, userId): Log batch task creation
Uses existing ActivityLog type from types/project.ts
Database Considerations
No schema changes required: Using existing notes field (JSONB) to store requirements array
Requirements format: notes will contain { requirements: string[], userStories?: string[], ...otherNotes }
Activity logs: Use existing activity_logs table if available, or extend with project-specific logging
AI Integration
Extend: lib/ai/geminiClient.ts if needed for embedding generation
Reuse: Existing Gemini API key configuration from admin settings
Date extraction: Use structured AI prompts to extract and parse dates from text
Task generation: Similar to projectAnalyzer.ts but focused on user-provided prompts
Key Implementation Details
Date Extraction Rules:
Parse specific dates: "March 15th", "2025-02-12"
Parse relative dates: "in 2 weeks", "end of quarter" → calculate from today
Parse implied dates: "before design review in June" → extract month/year
If multiple dates found, use earliest
If no date found or uncertain, leave dueDate as null
if no dates found. During the preview phase, the user should be able to go through and set start/end dates
Similarity Detection Algorithm:
Step 1: String similarity (title + description) - filter candidates (70%+ match)
Step 2: For candidates, use AI embeddings for semantic similarity
Step 3: Classify as "exact-duplicate" (>90% semantic), "possible-duplicate" (70-90%), "unique" (<70%)
Merge Logic:
Existing task remains parent (keeps ID, created_at, etc.)
Merge fields: description (append if different), requirements (merge arrays), notes (append), due_date (only if existing is null)
Create activity log entry
Discard AI task after merge
Preview Table Features:
Checkbox selection per row
Bulk select/deselect
Remove selected (removes from preview, doesn't affect DB)
Inject button (disabled if 0 tasks remain)
Regenerate button (goes back to input)
Back button (returns to input modal)
Error Handling:
Validate at least 1 task remains before injection
Handle AI API failures gracefully
Show user-friendly error messages
Log errors for debugging
Testing Considerations
Unit tests for similarity detection algorithms
Integration tests for API endpoints
E2E tests for full workflow (generate → preview → merge → inject)
Test edge cases: no dates in input, all duplicates, empty prompt, etc.
if no dates detected, during the preview phase, the user should be able to go through and set start/end dates