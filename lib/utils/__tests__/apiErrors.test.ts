import {
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  internalError,
  validationError,
  conflict,
  ErrorCode,
} from '../apiErrors';

describe('API error utilities', () => {
  describe('unauthorized', () => {
    it('should return 401 status with default message', async () => {
      const response = unauthorized();
      const json = await response.json();
      
      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
      expect(json.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('should return 401 status with custom message', async () => {
      const response = unauthorized('Custom unauthorized message');
      const json = await response.json();
      
      expect(response.status).toBe(401);
      expect(json.error).toBe('Custom unauthorized message');
    });

    it('should include details when provided', async () => {
      const response = unauthorized('Unauthorized', { reason: 'expired' });
      const json = await response.json();
      
      expect(json.details).toEqual({ reason: 'expired' });
    });
  });

  describe('forbidden', () => {
    it('should return 403 status with default message', async () => {
      const response = forbidden();
      const json = await response.json();
      
      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
      expect(json.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('should return 403 status with custom message', async () => {
      const response = forbidden('Access denied');
      const json = await response.json();
      
      expect(response.status).toBe(403);
      expect(json.error).toBe('Access denied');
    });
  });

  describe('notFound', () => {
    it('should return 404 status with default message', async () => {
      const response = notFound();
      const json = await response.json();
      
      expect(response.status).toBe(404);
      expect(json.error).toBe('Resource not found');
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('should return 404 status with custom message', async () => {
      const response = notFound('Project not found');
      const json = await response.json();
      
      expect(response.status).toBe(404);
      expect(json.error).toBe('Project not found');
    });
  });

  describe('badRequest', () => {
    it('should return 400 status with message', async () => {
      const response = badRequest('Invalid input');
      const json = await response.json();
      
      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid input');
      expect(json.code).toBe(ErrorCode.BAD_REQUEST);
    });

    it('should include details when provided', async () => {
      const response = badRequest('Invalid input', { field: 'email' });
      const json = await response.json();
      
      expect(json.details).toEqual({ field: 'email' });
    });
  });

  describe('validationError', () => {
    it('should return 400 status with validation errors', async () => {
      const details = {
        email: ['Email is required'],
        password: ['Password must be at least 8 characters'],
      };
      const response = validationError('Validation failed', details);
      const json = await response.json();
      
      expect(response.status).toBe(400);
      expect(json.error).toBe('Validation failed');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(json.details).toEqual(details);
    });
  });

  describe('conflict', () => {
    it('should return 409 status with default message', async () => {
      const response = conflict();
      const json = await response.json();
      
      expect(response.status).toBe(409);
      expect(json.error).toBe('Resource conflict');
      expect(json.code).toBe(ErrorCode.CONFLICT);
    });

    it('should return 409 status with custom message', async () => {
      const response = conflict('Email already exists');
      const json = await response.json();
      
      expect(response.status).toBe(409);
      expect(json.error).toBe('Email already exists');
    });
  });

  describe('internalError', () => {
    it('should return 500 status with default message', async () => {
      const response = internalError();
      const json = await response.json();
      
      expect(response.status).toBe(500);
      expect(json.error).toBe('Internal server error');
      expect(json.code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('should return 500 status with custom message', async () => {
      const response = internalError('Database connection failed');
      const json = await response.json();
      
      expect(response.status).toBe(500);
      expect(json.error).toBe('Database connection failed');
    });

    it('should include details when provided', async () => {
      const response = internalError('Error occurred', { stack: 'error stack' });
      const json = await response.json();
      
      expect(json.details).toEqual({ stack: 'error stack' });
    });
  });
});

