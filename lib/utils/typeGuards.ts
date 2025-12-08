/**
 * Type guard utilities for runtime type validation
 * Prevents 'any' type bugs by enforcing explicit type checking
 * 
 * Use these instead of 'as any' to ensure type safety at runtime
 */

// ============================================================================
// Core Type Guards
// ============================================================================

/**
 * Check if a value is not null or undefined
 * Useful for filtering arrays: items.filter(isNonNullable)
 */
export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

/**
 * Check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a number (and not NaN)
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// ============================================================================
// Property Access Guards
// ============================================================================

/**
 * Check if an object has a specific property
 * @example
 * if (hasProperty(obj, 'id')) {
 *   console.log(obj.id); // TypeScript knows 'id' exists
 * }
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * Check if an object has a property with a specific type
 * @example
 * if (hasStringProperty(obj, 'name')) {
 *   console.log(obj.name.toUpperCase()); // TypeScript knows 'name' is string
 * }
 */
export function hasStringProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, string> {
  return hasProperty(obj, key) && typeof obj[key] === 'string';
}

export function hasNumberProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, number> {
  return hasProperty(obj, key) && typeof obj[key] === 'number';
}

export function hasBooleanProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, boolean> {
  return hasProperty(obj, key) && typeof obj[key] === 'boolean';
}

export function hasArrayProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown[]> {
  return hasProperty(obj, key) && Array.isArray(obj[key]);
}

export function hasObjectProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, Record<string, unknown>> {
  return hasProperty(obj, key) && isObject(obj[key]);
}

/**
 * Check if an object has an optional string property (string | null | undefined)
 */
export function hasOptionalStringProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, string | null | undefined> {
  if (!hasProperty(obj, key)) return false;
  const value = obj[key];
  return value === null || value === undefined || typeof value === 'string';
}

// ============================================================================
// Supabase Response Guards
// ============================================================================

/**
 * Type for Supabase query response
 */
export interface SupabaseResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/**
 * Check if Supabase response has data (no error)
 * @example
 * const response = await supabase.from('users').select('*');
 * if (hasSupabaseData(response)) {
 *   // response.data is typed and guaranteed non-null
 *   response.data.forEach(user => console.log(user));
 * }
 */
export function hasSupabaseData<T>(
  response: SupabaseResponse<T>
): response is { data: T; error: null } {
  return response.error === null && response.data !== null;
}

/**
 * Check if Supabase response has an error
 */
export function hasSupabaseError<T>(
  response: SupabaseResponse<T>
): response is { data: null; error: { message: string; code?: string } } {
  return response.error !== null;
}

/**
 * Safely extract data from Supabase response with type validation
 * Returns undefined if data is null/undefined or validation fails
 */
export function extractSupabaseData<T>(
  response: SupabaseResponse<unknown>,
  validator: (data: unknown) => data is T
): T | undefined {
  if (!hasSupabaseData(response)) return undefined;
  if (validator(response.data)) return response.data;
  return undefined;
}

// ============================================================================
// Error Handling Guards
// ============================================================================

/**
 * Check if a value is an Error instance
 * Use in catch blocks instead of typing as 'any'
 * @example
 * catch (error) {
 *   if (isError(error)) {
 *     console.log(error.message);
 *   }
 * }
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Safely extract error message from unknown error
 * @example
 * catch (error) {
 *   logger.error(getErrorMessage(error));
 * }
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (isString(error)) return error;
  if (isObject(error) && hasStringProperty(error, 'message')) {
    return error.message;
  }
  return String(error);
}

/**
 * Safely extract error details for logging
 */
export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (isError(error)) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  if (isObject(error)) {
    return error;
  }
  return { error: String(error) };
}

// ============================================================================
// Database Row Type Guards
// ============================================================================

/**
 * Create a type guard for database rows with required fields
 * @example
 * const isUser = createRowGuard(['id', 'email', 'name']);
 * if (isUser(data)) {
 *   // data has id, email, name properties
 * }
 */
export function createRowGuard<K extends string>(
  requiredFields: K[]
): (value: unknown) => value is Record<K, unknown> {
  return (value: unknown): value is Record<K, unknown> => {
    if (!isObject(value)) return false;
    return requiredFields.every((field) => field in value);
  };
}

/**
 * Type guard for user row from database
 */
export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  organization_id: string | null;
  auth_id: string;
}

export function isUserRow(value: unknown): value is UserRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'email') &&
    hasStringProperty(value, 'auth_id') &&
    hasOptionalStringProperty(value, 'name') &&
    hasOptionalStringProperty(value, 'organization_id')
  );
}

/**
 * Type guard for organization row from database
 */
export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
}

export function isOrganizationRow(value: unknown): value is OrganizationRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'name') &&
    hasStringProperty(value, 'slug')
  );
}

/**
 * Type guard for project row from database
 */
export interface ProjectRow {
  id: string;
  name: string;
  organization_id: string;
  status: string;
}

export function isProjectRow(value: unknown): value is ProjectRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'name') &&
    hasStringProperty(value, 'organization_id') &&
    hasStringProperty(value, 'status')
  );
}

// ============================================================================
// Array Validation Guards
// ============================================================================

/**
 * Validate that all items in an array match a type guard
 * @example
 * if (isArrayOf(data, isUserRow)) {
 *   // data is typed as UserRow[]
 * }
 */
export function isArrayOf<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] {
  return isArray(value) && value.every(itemGuard);
}

/**
 * Filter and type an array, removing items that don't match the guard
 * @example
 * const users = filterByGuard(mixedData, isUserRow);
 * // users is typed as UserRow[]
 */
export function filterByGuard<T>(
  arr: unknown[],
  guard: (item: unknown) => item is T
): T[] {
  return arr.filter(guard);
}

// ============================================================================
// API Response Guards  
// ============================================================================

/**
 * Type for standard API response structure
 */
export interface ApiSuccessResponse<T> {
  data: T;
  error?: never;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  data?: never;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Check if API response is successful
 */
export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return 'data' in response && !('error' in response && response.error);
}

/**
 * Check if API response is an error
 */
export function isApiError<T>(
  response: ApiResponse<T>
): response is ApiErrorResponse {
  return 'error' in response && typeof response.error === 'string';
}

// ============================================================================
// JSON Parsing Guards
// ============================================================================

/**
 * Safely parse JSON with type validation
 * Returns undefined if parsing fails or validation fails
 * @example
 * const user = safeJsonParse(jsonString, isUserRow);
 * if (user) {
 *   // user is typed as UserRow
 * }
 */
export function safeJsonParse<T>(
  json: string,
  validator: (data: unknown) => data is T
): T | undefined {
  try {
    const parsed: unknown = JSON.parse(json);
    if (validator(parsed)) return parsed;
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse JSON and return unknown type (safer than any)
 * Forces caller to validate the result
 */
export function parseJsonUnknown(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

// ============================================================================
// Assertion Functions
// ============================================================================

/**
 * Assert that a value is of a certain type, throw if not
 * Use sparingly - prefer guards that handle both cases
 * @example
 * assertIsString(value, 'Expected value to be a string');
 * // After this line, value is typed as string
 */
export function assertIsString(
  value: unknown,
  message = 'Expected string'
): asserts value is string {
  if (!isString(value)) {
    throw new TypeError(message);
  }
}

export function assertIsNumber(
  value: unknown,
  message = 'Expected number'
): asserts value is number {
  if (!isNumber(value)) {
    throw new TypeError(message);
  }
}

export function assertIsObject(
  value: unknown,
  message = 'Expected object'
): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new TypeError(message);
  }
}

export function assertIsArray(
  value: unknown,
  message = 'Expected array'
): asserts value is unknown[] {
  if (!isArray(value)) {
    throw new TypeError(message);
  }
}

/**
 * Assert that a value is not null or undefined
 */
export function assertNonNullable<T>(
  value: T,
  message = 'Expected non-nullable value'
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new TypeError(message);
  }
}

// ============================================================================
// Domain-Specific Type Guards
// ============================================================================

/**
 * Type guard for activity log row
 */
export interface ActivityLogRow {
  id: string;
  user_id: string | null;
  action_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export function isActivityLogRow(value: unknown): value is ActivityLogRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'action_type') &&
    hasStringProperty(value, 'created_at')
  );
}

/**
 * Type guard for dashboard widget row
 */
export interface DashboardWidgetRow {
  id: string;
  dashboard_id: string;
  widget_type: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
}

export function isDashboardWidgetRow(value: unknown): value is DashboardWidgetRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'dashboard_id') &&
    hasStringProperty(value, 'widget_type') &&
    hasObjectProperty(value, 'config') &&
    hasObjectProperty(value, 'position')
  );
}

/**
 * Type guard for KB article row
 */
export interface KBArticleRow {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: string;
}

export function isKBArticleRow(value: unknown): value is KBArticleRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'title') &&
    hasStringProperty(value, 'slug') &&
    hasStringProperty(value, 'content') &&
    hasStringProperty(value, 'status')
  );
}

/**
 * Type guard for KB analytics row
 */
export interface KBAnalyticsRow {
  id: string;
  article_id: string | null;
  action_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export function isKBAnalyticsRow(value: unknown): value is KBAnalyticsRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'action_type') &&
    hasStringProperty(value, 'created_at')
  );
}

/**
 * Type guard for SOW member row
 */
export interface SOWMemberRow {
  id: string;
  sow_id: string;
  user_id: string;
  role: string | null;
  allocation_percentage: number | null;
}

export function isSOWMemberRow(value: unknown): value is SOWMemberRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'sow_id') &&
    hasStringProperty(value, 'user_id')
  );
}

/**
 * Type guard for project task row
 */
export interface ProjectTaskRow {
  id: string;
  project_id: string;
  title: string;
  status: string;
  priority: string;
}

export function isProjectTaskRow(value: unknown): value is ProjectTaskRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'project_id') &&
    hasStringProperty(value, 'title') &&
    hasStringProperty(value, 'status') &&
    hasStringProperty(value, 'priority')
  );
}

/**
 * Type guard for project phase row
 */
export interface ProjectPhaseRow {
  id: string;
  project_id: string;
  phase_number: number;
  data: Record<string, unknown>;
  completed: boolean;
}

export function isProjectPhaseRow(value: unknown): value is ProjectPhaseRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'project_id') &&
    hasNumberProperty(value, 'phase_number') &&
    hasBooleanProperty(value, 'completed')
  );
}

/**
 * Type guard for team row
 */
export interface TeamRow {
  id: string;
  name: string;
  organization_id: string;
}

export function isTeamRow(value: unknown): value is TeamRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'name') &&
    hasStringProperty(value, 'organization_id')
  );
}

/**
 * Type guard for company row
 */
export interface CompanyRow {
  id: string;
  name: string;
  organization_id: string;
}

export function isCompanyRow(value: unknown): value is CompanyRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'name') &&
    hasStringProperty(value, 'organization_id')
  );
}

/**
 * Type guard for contact row
 */
export interface ContactRow {
  id: string;
  first_name: string;
  company_id: string | null;
}

export function isContactRow(value: unknown): value is ContactRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'first_name')
  );
}

/**
 * Type guard for opportunity row
 */
export interface OpportunityRow {
  id: string;
  name: string;
  status: string;
  organization_id: string;
}

export function isOpportunityRow(value: unknown): value is OpportunityRow {
  return (
    isObject(value) &&
    hasStringProperty(value, 'id') &&
    hasStringProperty(value, 'name') &&
    hasStringProperty(value, 'status') &&
    hasStringProperty(value, 'organization_id')
  );
}

// ============================================================================
// Helper for iterating typed arrays
// ============================================================================

/**
 * Safely map over array items with type checking
 * Items that don't match the guard are filtered out
 * @example
 * const userIds = safeMap(data, isUserRow, user => user.id);
 */
export function safeMap<T, R>(
  arr: unknown[],
  guard: (item: unknown) => item is T,
  mapper: (item: T) => R
): R[] {
  return arr.filter(guard).map(mapper);
}

/**
 * Extract a property from array items with type checking
 * @example
 * const userIds = extractProperty(users, 'id', isString);
 */
export function extractProperty<K extends string, V>(
  arr: unknown[],
  key: K,
  valueGuard: (val: unknown) => val is V
): V[] {
  return arr
    .filter(isObject)
    .filter((item): item is Record<K, V> => 
      hasProperty(item, key) && valueGuard(item[key])
    )
    .map(item => item[key]);
}

/**
 * Extract string IDs from array of objects
 * Common pattern for extracting user_id, organization_id, etc.
 */
export function extractIds(arr: unknown[], key = 'id'): string[] {
  return extractProperty(arr, key, isString);
}

