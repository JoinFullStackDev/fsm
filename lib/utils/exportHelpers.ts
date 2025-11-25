/**
 * Utility functions for export-related operations
 */

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "500 KB")
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return 'Unknown';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

/**
 * Get export type display label
 * @param type - Export type string
 * @returns Human-readable label
 */
export function getExportTypeLabel(type: string): string {
  switch (type) {
    case 'blueprint_bundle':
      return 'Blueprint Bundle';
    case 'cursor_bundle':
      return 'Cursor Bundle';
    case 'prd':
      return 'PRD';
    default:
      // Capitalize and format: blueprint_bundle -> Blueprint Bundle
      return type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }
}

/**
 * Get export type color for Material-UI chips
 * @param type - Export type string
 * @returns Material-UI chip color
 */
export function getExportTypeColor(
  type: string
): 'primary' | 'secondary' | 'success' | 'default' {
  switch (type) {
    case 'blueprint_bundle':
      return 'primary';
    case 'cursor_bundle':
      return 'secondary';
    case 'prd':
      return 'success';
    default:
      return 'default';
  }
}

/**
 * Get export file extension based on type
 * @param type - Export type string
 * @returns File extension (e.g., '.zip', '.md')
 */
export function getExportFileExtension(type: string): string {
  switch (type) {
    case 'blueprint_bundle':
    case 'cursor_bundle':
      return '.zip';
    case 'prd':
      return '.md';
    default:
      return '.zip';
  }
}

/**
 * Generate export filename
 * @param projectName - Name of the project
 * @param exportType - Type of export
 * @returns Sanitized filename
 */
export function generateExportFilename(
  projectName: string,
  exportType: string
): string {
  const sanitizedName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const extension = getExportFileExtension(exportType);
  const typeLabel = exportType.replace('_', '-');
  
  return `${sanitizedName}_${typeLabel}${extension}`;
}

