import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../lib/error-monitor', () => ({
  errorMonitor: {
    track: vi.fn(),
  },
}));

import { errorSanitizer, globalErrorHandler } from '../middleware/error-sanitizer';

function createMockReq(overrides = {}) {
  return {
    session: {},
    cookies: {},
    headers: {},
    method: 'GET',
    path: '/',
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
  };
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.headersSent = false;
  return res;
}

describe('Error Sanitizer Middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('errorSanitizer', () => {
    it('should call next to continue middleware chain', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      errorSanitizer(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should not modify response when not called', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      errorSanitizer(req, res, next);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('globalErrorHandler', () => {
    it('should respond with 500 for errors without status', () => {
      const err = new Error('Something broke') as any;
      const req = createMockReq({ path: '/api/test', method: 'GET' });
      const res = createMockRes();
      const next = vi.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });

    it('should use err.status when available', () => {
      const err = new Error('Not found') as any;
      err.status = 404;
      const req = createMockReq({ path: '/api/missing', method: 'GET' });
      const res = createMockRes();
      const next = vi.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should use err.statusCode when available', () => {
      const err = new Error('Bad request') as any;
      err.statusCode = 400;
      const req = createMockReq({ path: '/api/bad', method: 'POST' });
      const res = createMockRes();
      const next = vi.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should not send response if headers already sent', () => {
      const err = new Error('Duplicate send') as any;
      const req = createMockReq();
      const res = createMockRes();
      res.headersSent = true;
      const next = vi.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(err);
    });

    it('should return JSON error response', () => {
      const err = new Error('Server error') as any;
      const req = createMockReq({ path: '/api/data', method: 'POST' });
      const res = createMockRes();
      const next = vi.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('should include error message field in response', () => {
      const err = new Error('Specific error detail') as any;
      const req = createMockReq({ path: '/api/test', method: 'GET' });
      const res = createMockRes();
      const next = vi.fn();

      globalErrorHandler(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error).toBeDefined();
      expect(typeof jsonCall.error).toBe('string');
    });

    it('should handle non-Error objects thrown as errors', () => {
      const err = 'string error' as any;
      const req = createMockReq({ path: '/api/oops', method: 'GET' });
      const res = createMockRes();
      const next = vi.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });

    it('should track error with error monitor', async () => {
      const { errorMonitor } = await import('../lib/error-monitor');
      const err = new Error('Tracked error') as any;
      const req = createMockReq({ path: '/api/track', method: 'DELETE' });
      const res = createMockRes();
      const next = vi.fn();

      globalErrorHandler(err, req, res, next);

      expect(errorMonitor.track).toHaveBeenCalled();
    });

    it('should respond with error for 500 status', () => {
      const err = new Error('Internal failure') as any;
      const req = createMockReq({ path: '/api/users', method: 'GET' });
      const res = createMockRes();
      const next = vi.fn();

      globalErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error).toBeDefined();
      expect(typeof jsonCall.error).toBe('string');
    });
  });
});
