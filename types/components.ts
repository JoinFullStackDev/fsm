/**
 * Shared type definitions for reusable component interfaces
 */

import type { TemplateFieldConfig } from './templates';

/**
 * Standard props interface for all template field components
 */
export interface BaseFieldProps {
  field: TemplateFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

/**
 * Standard props interface for form components
 */
export interface BaseFormProps<T> {
  data: T;
  onChange: (data: T) => void;
}

/**
 * Standard loading state configuration
 */
export interface LoadingState {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

