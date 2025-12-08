import type { ProjectTask } from './project';

/**
 * Duplicate status for AI-generated tasks
 */
export type DuplicateStatus = 'unique' | 'possible-duplicate' | 'exact-duplicate';

/**
 * Source field reference from AI generation
 * Links generated task to the phase field(s) that informed its creation
 */
export interface SourceField {
  phase: number;
  field: string;
}

/**
 * Preview task with duplicate detection information
 * Extends ProjectTask with additional fields for preview/audit
 */
export interface PreviewTask extends Omit<ProjectTask, 'id' | 'created_at' | 'updated_at' | 'project_id'> {
  /**
   * Duplicate detection status
   */
  duplicateStatus: DuplicateStatus;
  
  /**
   * ID of existing task if duplicate detected
   */
  existingTaskId: string | null;
  
  /**
   * Requirements array extracted from AI generation
   * Stored in notes field as JSON: { requirements: string[], ... }
   */
  requirements: string[];
  
  /**
   * User stories if extracted from prompt
   */
  userStories?: string[];
  
  /**
   * Temporary ID for preview (not persisted)
   */
  previewId?: string;
  
  /**
   * Source fields from AI generation - indicates which phase fields
   * generated this task. Converted to source_reference on save.
   */
  source_fields?: SourceField[];
}

/**
 * Task to be injected (created)
 */
export interface TaskInjection {
  /**
   * Preview task data
   */
  task: PreviewTask;
  
  /**
   * Whether this task should be created
   */
  selected: boolean;
}

/**
 * Task merge operation specification
 */
export interface TaskMerge {
  /**
   * Preview task ID (temporary)
   */
  previewTaskId: string;
  
  /**
   * Existing task ID to merge into
   */
  existingTaskId: string;
  
  /**
   * Merge action: 'merge' | 'keep-both' | 'discard'
   */
  action: 'merge' | 'keep-both' | 'discard';
}

/**
 * Preview generation request
 */
export interface PreviewGenerationRequest {
  /**
   * User prompt/PRD/spec text
   */
  prompt: string;
  
  /**
   * Optional additional context
   */
  context?: string;
}

/**
 * Preview generation response
 */
export interface PreviewGenerationResponse {
  /**
   * Generated preview tasks
   */
  tasks: PreviewTask[];
  
  /**
   * Summary of generation
   */
  summary?: string;
  
  /**
   * AI generation response time in milliseconds
   * Used for logging and performance tracking
   */
  response_time_ms?: number;
}

/**
 * Task injection request
 */
export interface TaskInjectionRequest {
  /**
   * Tasks to create
   */
  tasks: TaskInjection[];
  
  /**
   * Merge operations to perform
   */
  merges: TaskMerge[];
}

/**
 * Task injection response
 */
export interface TaskInjectionResponse {
  /**
   * Number of tasks created
   */
  created: number;
  
  /**
   * Number of tasks merged
   */
  merged: number;
  
  /**
   * Any errors encountered
   */
  errors?: string[];
}

