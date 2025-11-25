import {
  formatFileSize,
  getExportTypeLabel,
  getExportTypeColor,
  getExportFileExtension,
  generateExportFilename,
} from '../exportHelpers';

describe('exportHelpers', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('Unknown');
      expect(formatFileSize(null)).toBe('Unknown');
      expect(formatFileSize(undefined)).toBe('Unknown');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('getExportTypeLabel', () => {
    it('should return correct labels for known types', () => {
      expect(getExportTypeLabel('blueprint_bundle')).toBe('Blueprint Bundle');
      expect(getExportTypeLabel('cursor_bundle')).toBe('Cursor Bundle');
      expect(getExportTypeLabel('prd')).toBe('PRD');
    });

    it('should format unknown types', () => {
      expect(getExportTypeLabel('custom_type')).toBe('Custom Type');
      expect(getExportTypeLabel('test_export')).toBe('Test Export');
    });
  });

  describe('getExportTypeColor', () => {
    it('should return correct colors for known types', () => {
      expect(getExportTypeColor('blueprint_bundle')).toBe('primary');
      expect(getExportTypeColor('cursor_bundle')).toBe('secondary');
      expect(getExportTypeColor('prd')).toBe('success');
      expect(getExportTypeColor('unknown')).toBe('default');
    });
  });

  describe('getExportFileExtension', () => {
    it('should return correct extensions', () => {
      expect(getExportFileExtension('blueprint_bundle')).toBe('.zip');
      expect(getExportFileExtension('cursor_bundle')).toBe('.zip');
      expect(getExportFileExtension('prd')).toBe('.md');
      expect(getExportFileExtension('unknown')).toBe('.zip');
    });
  });

  describe('generateExportFilename', () => {
    it('should generate correct filenames', () => {
      const filename1 = generateExportFilename('My Project', 'blueprint_bundle');
      expect(filename1).toBe('my_project_blueprint-bundle.zip');
      
      const filename2 = generateExportFilename('Test Project!', 'cursor_bundle');
      expect(filename2).toBe('test_project__cursor-bundle.zip');
      
      const filename3 = generateExportFilename('PRD Project', 'prd');
      expect(filename3).toBe('prd_project_prd.md');
    });

    it('should handle special characters', () => {
      const filename = generateExportFilename('Project@#$%', 'blueprint_bundle');
      // Each special character (@, #, $, %) becomes an underscore, plus one for the space
      // "Project@#$%" -> "project_____" (project + 5 underscores)
      expect(filename).toBe('project_____blueprint-bundle.zip');
    });
  });
});

