/**
 * File upload validation utilities
 * Provides server-side validation for file uploads
 */

import { badRequest } from './apiErrors';
import { NextResponse } from 'next/server';

// Allowed MIME types by category
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  // Add more categories as needed
} as const;

// File size limits (in bytes)
const MAX_FILE_SIZES = {
  image: {
    logo: 2 * 1024 * 1024, // 2MB
    icon: 1 * 1024 * 1024, // 1MB
    general: 5 * 1024 * 1024, // 5MB
  },
  document: 10 * 1024 * 1024, // 10MB
  general: 10 * 1024 * 1024, // 10MB
} as const;

/**
 * Magic bytes (file signatures) for common file types
 * Used to verify file type regardless of extension or MIME type
 */
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header, need to check further
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

/**
 * Check file type using magic bytes
 * Returns MIME type if detected, null otherwise
 */
export async function detectFileType(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 16)); // Check first 16 bytes

    for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
      for (const signature of signatures) {
        if (signature.every((byte, index) => bytes[index] === byte)) {
          // Special handling for WebP (RIFF header)
          if (mimeType === 'image/webp') {
            const webpCheck = new TextDecoder().decode(bytes.slice(8, 12));
            if (webpCheck === 'WEBP') {
              return mimeType;
            }
          } else {
            return mimeType;
          }
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal sequences
  let sanitized = filename
    .replace(/\.\./g, '') // Remove ..
    .replace(/\/+/g, '_') // Replace slashes with underscores
    .replace(/\\+/g, '_') // Replace backslashes with underscores
    .replace(/^[\/\\]+/, '') // Remove leading slashes
    .replace(/[\/\\]+$/, ''); // Remove trailing slashes

  // Remove or replace dangerous characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    sanitized = sanitized.substring(0, 255 - ext.length) + ext;
  }

  return sanitized;
}

/**
 * Validate file upload
 * @param file - File object to validate
 * @param allowedTypes - Array of allowed MIME types or categories ('image', 'document', etc.)
 * @param maxSize - Maximum file size in bytes
 * @param requireMagicBytes - Whether to verify file type using magic bytes (default: true)
 */
export async function validateFileUpload(
  file: File,
  allowedTypes: string[],
  maxSize: number,
  requireMagicBytes: boolean = true
): Promise<{ valid: boolean; error?: NextResponse }> {
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: badRequest(`File size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`),
    };
  }

  // Check if file size is 0
  if (file.size === 0) {
    return {
      valid: false,
      error: badRequest('File is empty'),
    };
  }

  // Expand category types to actual MIME types
  const expandedTypes: string[] = [];
  for (const type of allowedTypes) {
    if (type in ALLOWED_MIME_TYPES) {
      expandedTypes.push(...ALLOWED_MIME_TYPES[type as keyof typeof ALLOWED_MIME_TYPES]);
    } else {
      expandedTypes.push(type);
    }
  }

  // Check MIME type
  if (!expandedTypes.includes(file.type)) {
    return {
      valid: false,
      error: badRequest(`File type not allowed. Allowed types: ${expandedTypes.join(', ')}`),
    };
  }

  // Verify file type using magic bytes if required
  if (requireMagicBytes) {
    const detectedType = await detectFileType(file);
    if (detectedType && !expandedTypes.includes(detectedType)) {
      return {
        valid: false,
        error: badRequest('File type mismatch detected. File content does not match declared type.'),
      };
    }
  }

  // Validate filename
  const sanitizedFilename = sanitizeFilename(file.name);
  if (sanitizedFilename !== file.name && sanitizedFilename.length === 0) {
    return {
      valid: false,
      error: badRequest('Invalid filename'),
    };
  }

  return { valid: true };
}

/**
 * Get max file size for a file type
 */
export function getMaxFileSize(type: 'image' | 'document' | 'general', subtype?: 'logo' | 'icon'): number {
  if (type === 'image' && subtype) {
    return MAX_FILE_SIZES.image[subtype];
  }
  if (type === 'image') {
    return MAX_FILE_SIZES.image.general;
  }
  if (type === 'document') {
    return MAX_FILE_SIZES.document;
  }
  return MAX_FILE_SIZES.general;
}
