import { vi, describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { csrfTokenGenerator, csrfProtection } from '../middleware/csrf';

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
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

describe('CSRF Middleware', () => {
  describe('csrfTokenGenerator', () => {
    it('should set a CSRF cookie if none exists', () => {
      const req = createMockReq({ cookies: {} });
      const res = createMockRes();
      const next = vi.fn();

      csrfTokenGenerator(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'csrf_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should not set cookie if one already exists', () => {
      const req = createMockReq({ cookies: { csrf_token: 'existing-token' } });
      const res = createMockRes();
      const next = vi.fn();

      csrfTokenGenerator(req, res, next);

      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('csrfProtection', () => {
    it('should allow GET requests', () => {
      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow HEAD requests', () => {
      const req = createMockReq({ method: 'HEAD' });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow OPTIONS requests', () => {
      const req = createMockReq({ method: 'OPTIONS' });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block POST without CSRF token for authenticated users', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/data',
        session: { userId: 'user-1' },
        cookies: {},
        headers: {},
      });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token missing' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow POST with valid matching CSRF token', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'POST',
        path: '/api/data',
        session: { userId: 'user-1' },
        cookies: { csrf_token: token },
        headers: { 'x-csrf-token': token },
      });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject POST with mismatched CSRF tokens', () => {
      const cookieToken = crypto.randomBytes(32).toString('hex');
      const headerToken = crypto.randomBytes(32).toString('hex');
      const req = createMockReq({
        method: 'POST',
        path: '/api/data',
        session: { userId: 'user-1' },
        cookies: { csrf_token: cookieToken },
        headers: { 'x-csrf-token': headerToken },
      });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token invalid' });
    });

    it('should allow exempt path /auth/login', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/auth/login',
        session: { userId: 'user-1' },
      });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow exempt path /auth/register', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/auth/register',
        session: { userId: 'user-1' },
      });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow agent routes (exempt)', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/agent/some-action',
        session: { userId: 'user-1' },
      });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow /health path (exempt)', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/health',
        session: { userId: 'user-1' },
      });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow unauthenticated POST requests through', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/data',
        session: {},
      });
      const res = createMockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
