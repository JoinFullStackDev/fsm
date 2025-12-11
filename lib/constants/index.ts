/**
 * Application-wide constants
 * Consolidates magic strings, status values, and configuration constants
 */

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  PM: 'pm',
  DESIGNER: 'designer',
  ENGINEER: 'engineer',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const VALID_USER_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.PM,
  USER_ROLES.DESIGNER,
  USER_ROLES.ENGINEER,
];

// Project Statuses
export const PROJECT_STATUSES = {
  IDEA: 'idea',
  IN_PROGRESS: 'in_progress',
  BLUEPRINT_READY: 'blueprint_ready',
  ARCHIVED: 'archived',
} as const;

export type ProjectStatus = typeof PROJECT_STATUSES[keyof typeof PROJECT_STATUSES];

export const VALID_PROJECT_STATUSES: ProjectStatus[] = [
  PROJECT_STATUSES.IDEA,
  PROJECT_STATUSES.IN_PROGRESS,
  PROJECT_STATUSES.BLUEPRINT_READY,
  PROJECT_STATUSES.ARCHIVED,
];

// Task Statuses
export const TASK_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  ARCHIVED: 'archived',
} as const;

export type TaskStatus = typeof TASK_STATUSES[keyof typeof TASK_STATUSES];

export const VALID_TASK_STATUSES: TaskStatus[] = [
  TASK_STATUSES.TODO,
  TASK_STATUSES.IN_PROGRESS,
  TASK_STATUSES.DONE,
  TASK_STATUSES.ARCHIVED,
];

// Task Priorities
export const TASK_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type TaskPriority = typeof TASK_PRIORITIES[keyof typeof TASK_PRIORITIES];

export const VALID_TASK_PRIORITIES: TaskPriority[] = [
  TASK_PRIORITIES.LOW,
  TASK_PRIORITIES.MEDIUM,
  TASK_PRIORITIES.HIGH,
  TASK_PRIORITIES.CRITICAL,
];

// Analysis Types
export const ANALYSIS_TYPES = {
  INITIAL: 'initial',
  UPDATE: 'update',
} as const;

export type AnalysisType = typeof ANALYSIS_TYPES[keyof typeof ANALYSIS_TYPES];

// Status Colors
export const STATUS_COLORS: Record<TaskStatus, string> = {
  [TASK_STATUSES.TODO]: '#B0B0B0',
  [TASK_STATUSES.IN_PROGRESS]: '#C9354A',
  [TASK_STATUSES.DONE]: '#00FF88',
  [TASK_STATUSES.ARCHIVED]: '#666666',
};

// Priority Colors
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  [TASK_PRIORITIES.LOW]: '#B0B0B0',
  [TASK_PRIORITIES.MEDIUM]: '#FFA726',
  [TASK_PRIORITIES.HIGH]: '#FF6B6B',
  [TASK_PRIORITIES.CRITICAL]: '#E91E63',
};

// Default Phase Names (for backward compatibility)
export const DEFAULT_PHASE_NAMES: Record<number, string> = {
  1: 'Concept',
  2: 'Strategy',
  3: 'Prototype',
  4: 'Analysis',
  5: 'Build',
  6: 'QA',
};

// Primary Tools
export const PRIMARY_TOOLS = {
  CURSOR: 'cursor',
  REPLIT: 'replit',
  LOVABLE: 'lovable',
  BASE44: 'base44',
  OTHER: 'other',
} as const;

export type PrimaryTool = typeof PRIMARY_TOOLS[keyof typeof PRIMARY_TOOLS];

export const VALID_PRIMARY_TOOLS: PrimaryTool[] = [
  PRIMARY_TOOLS.CURSOR,
  PRIMARY_TOOLS.REPLIT,
  PRIMARY_TOOLS.LOVABLE,
  PRIMARY_TOOLS.BASE44,
  PRIMARY_TOOLS.OTHER,
];

// API Configuration Keys
export const API_CONFIG_KEYS = {
  GEMINI_KEY: 'api_gemini_key',
  GEMINI_KEY_ALT: 'gemini_api_key',
  GEMINI_ENABLED: 'api_gemini_enabled',
  GEMINI_PROJECT_NAME: 'api_gemini_project_name',
} as const;

// Notification Types
export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: 'task_assigned',
  PROJECT_CREATED: 'project_created',
  PHASE_COMPLETED: 'phase_completed',
  PROJECT_UPDATED: 'project_updated',
  KB_ARTICLE_PUBLISHED: 'kb_article_published',
  KB_ARTICLE_UPDATED: 'kb_article_updated',
  KB_CATEGORY_ADDED: 'kb_category_added',
  KB_RELEASE_NOTES_PUBLISHED: 'kb_release_notes_published',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// Pagination Defaults
export const PAGINATION_DEFAULTS = {
  LIMIT: 50,
  OFFSET: 0,
} as const;

// Field Types
export const FIELD_TYPES = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  ARRAY: 'array',
  OBJECT: 'object',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  SLIDER: 'slider',
  DATE: 'date',
  FILE: 'file',
  TABLE: 'table',
  ERD: 'erd',
  CUSTOM: 'custom',
} as const;

export type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES];

