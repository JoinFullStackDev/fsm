/**
 * Standardized API error response utility
 * Provides consistent error format across all API routes
 */

import { NextResponse } from 'next/server';
import logger from './logger';

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
}

export interface ApiErrorResponse {
  error: string;
  code?: ErrorCode;
  details?: string | Record<string, any>;
}

/**
 * Create a standardized error response
 * @param message - User-friendly error message
 * @param code - Error code enum
 * @param status - HTTP status code
 * @param details - Additional error details
 */
function createErrorResponse(
  message: string,
  code: ErrorCode = ErrorCode.INTERNAL_ERROR,
  status: number = 500,
  details?: string | Record<string, any>
): NextResponse<ApiErrorResponse> {
  logger.error(`API Error [${status} - ${code}]: ${message}`, details);
  
  const response: ApiErrorResponse = {
    error: message,
    code,
  };

  if (details) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Create an unauthorized error response (401)
 */
export function unauthorized(message: string = 'Unauthorized', details?: string | Record<string, any>): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, ErrorCode.UNAUTHORIZED, 401, details);
}

/**
 * Create a forbidden error response (403)
 */
export function forbidden(message: string = 'Forbidden', details?: string | Record<string, any>): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, ErrorCode.FORBIDDEN, 403, details);
}

/**
 * Create a not found error response (404)
 */
export function notFound(message: string = 'Resource not found', details?: string | Record<string, any>): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, ErrorCode.NOT_FOUND, 404, details);
}

/**
 * Create a validation error response (400)
 */
export function validationError(
  message: string,
  details?: Record<string, string[]>
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    message,
    ErrorCode.VALIDATION_ERROR,
    400,
    details
  );
}

/**
 * Create a bad request error response (400)
 */
export function badRequest(message: string, details?: string | Record<string, any>): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, ErrorCode.BAD_REQUEST, 400, details);
}

/**
 * Create a conflict error response (409)
 */
export function conflict(message: string = 'Resource conflict', details?: string | Record<string, any>): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, ErrorCode.CONFLICT, 409, details);
}

/**
 * Create an internal server error response (500)
 */
export function internalError(
  message: string = 'Internal server error',
  details?: string | Record<string, any>
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, ErrorCode.INTERNAL_ERROR, 500, details);
}

