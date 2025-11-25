import {
  validateEmail,
  validateRequired,
  validateLength,
  validateProjectName,
  validateUserName,
  validateFieldKey,
  validateFieldLabel,
} from '../validation';

describe('validation utilities', () => {
  describe('validateEmail', () => {
    it('should return valid for a valid email', () => {
      const result = validateEmail('user@example.com');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for empty email', () => {
      const result = validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should return invalid for email with only whitespace', () => {
      const result = validateEmail('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should return invalid for email without @', () => {
      const result = validateEmail('userexample.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should return invalid for email without domain', () => {
      const result = validateEmail('user@');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should return invalid for email without TLD', () => {
      const result = validateEmail('user@example');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should return valid for email with subdomain', () => {
      const result = validateEmail('user@mail.example.com');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateRequired', () => {
    it('should return valid for non-empty string', () => {
      const result = validateRequired('test');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for empty string', () => {
      const result = validateRequired('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field is required');
    });

    it('should return invalid for whitespace-only string', () => {
      const result = validateRequired('   ');
      expect(result.valid).toBe(false);
    });

    it('should use custom field name in error', () => {
      const result = validateRequired('', 'Project name');
      expect(result.error).toBe('Project name is required');
    });
  });

  describe('validateLength', () => {
    it('should return valid when within min and max', () => {
      const result = validateLength('test', 1, 10);
      expect(result.valid).toBe(true);
    });

    it('should return invalid when below min', () => {
      const result = validateLength('ab', 3, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field must be at least 3 characters');
    });

    it('should return invalid when above max', () => {
      const result = validateLength('abcdefghijklmnop', 1, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field must be no more than 10 characters');
    });

    it('should work with only min constraint', () => {
      const result = validateLength('test', 3);
      expect(result.valid).toBe(true);
    });

    it('should work with only max constraint', () => {
      const result = validateLength('test', undefined, 10);
      expect(result.valid).toBe(true);
    });

    it('should use custom field name in error', () => {
      const result = validateLength('ab', 3, 10, 'Project name');
      expect(result.error).toBe('Project name must be at least 3 characters');
    });
  });

  describe('validateProjectName', () => {
    it('should return valid for valid project name', () => {
      const result = validateProjectName('My Project');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for empty string', () => {
      const result = validateProjectName('');
      expect(result.valid).toBe(false);
    });

    it('should return invalid for whitespace-only', () => {
      const result = validateProjectName('   ');
      expect(result.valid).toBe(false);
      // The function returns "Project name is required" for empty/whitespace
      expect(result.error).toBeDefined();
    });

    it('should return invalid for name exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = validateProjectName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('no more than 100 characters');
    });
  });

  describe('validateUserName', () => {
    it('should return valid for valid user name', () => {
      const result = validateUserName('John Doe');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for empty string', () => {
      const result = validateUserName('');
      expect(result.valid).toBe(false);
    });

    it('should return invalid for name exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = validateUserName(longName);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFieldKey', () => {
    it('should return valid for lowercase alphanumeric with underscores', () => {
      const result = validateFieldKey('field_key_123');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for empty string', () => {
      const result = validateFieldKey('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field key is required');
    });

    it('should return invalid for uppercase letters', () => {
      const result = validateFieldKey('FieldKey');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field key must be lowercase letters, numbers, and underscores only');
    });

    it('should return invalid for special characters', () => {
      const result = validateFieldKey('field-key');
      expect(result.valid).toBe(false);
    });

    it('should return invalid for spaces', () => {
      const result = validateFieldKey('field key');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFieldLabel', () => {
    it('should return valid for valid label', () => {
      const result = validateFieldLabel('Field Label');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for empty string', () => {
      const result = validateFieldLabel('');
      expect(result.valid).toBe(false);
    });

    it('should return invalid for label exceeding 200 characters', () => {
      const longLabel = 'a'.repeat(201);
      const result = validateFieldLabel(longLabel);
      expect(result.valid).toBe(false);
    });
  });
});

