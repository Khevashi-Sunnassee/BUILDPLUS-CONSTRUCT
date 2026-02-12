import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../server/storage', () => ({
  storage: {
    getUser: vi.fn(),
  },
}));

import { requireAuth, requireRole, requireCompanyContext } from '../routes/middleware/auth.middleware';
import { storage } from '../storage';

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

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should reject requests without session userId', () => {
      const req = createMockReq({ session: {} });
      const res = createMockRes();
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow requests with session userId', () => {
      const req = createMockReq({ session: { userId: 'user-123' } });
      const res = createMockRes();
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set companyId on request from session', () => {
      const req = createMockReq({
        session: { userId: 'user-123', companyId: 'company-456' },
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(req.companyId).toBe('company-456');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should reject if user has no session', async () => {
      const middleware = requireRole('ADMIN');
      const req = createMockReq({ session: {} });
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should reject if user does not have required role', async () => {
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 'user-123',
        role: 'USER',
        email: 'test@test.com',
        name: 'Test',
        companyId: 'comp-1',
      } as any);

      const middleware = requireRole('ADMIN');
      const req = createMockReq({ session: { userId: 'user-123' } });
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should allow if user has the required role', async () => {
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 'user-123',
        role: 'ADMIN',
        email: 'admin@test.com',
        name: 'Admin',
        companyId: 'comp-1',
      } as any);

      const middleware = requireRole('ADMIN');
      const req = createMockReq({
        session: { userId: 'user-123', companyId: 'comp-1' },
      });
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.companyId).toBe('comp-1');
    });

    it('should reject if user is not found', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null as any);

      const middleware = requireRole('ADMIN');
      const req = createMockReq({ session: { userId: 'nonexistent' } });
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should accept any of multiple roles', async () => {
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 'user-123',
        role: 'MANAGER',
        email: 'mgr@test.com',
        name: 'Manager',
        companyId: 'comp-1',
      } as any);

      const middleware = requireRole('ADMIN', 'MANAGER');
      const req = createMockReq({
        session: { userId: 'user-123', companyId: 'comp-1' },
      });
      const res = createMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireCompanyContext', () => {
    it('should reject without companyId in session', () => {
      const req = createMockReq({ session: {} });
      const res = createMockRes();
      const next = vi.fn();

      requireCompanyContext(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Company context required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow with companyId in session', () => {
      const req = createMockReq({
        session: { companyId: 'company-789' },
      });
      const res = createMockRes();
      const next = vi.fn();

      requireCompanyContext(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.companyId).toBe('company-789');
    });
  });
});
