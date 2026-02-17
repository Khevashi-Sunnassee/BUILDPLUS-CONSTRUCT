import { vi, describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeRequestBody,
  validateContentType,
  validateAllParams,
  validateUUIDParams,
  enforceBodyLimits,
  sanitizeQueryStrings,
  isValidUUID,
} from '../middleware/sanitize';

function createMockReq(overrides = {}) {
  return {
    body: {},
    headers: {},
    method: 'GET',
    path: '/',
    params: {},
    query: {},
    is: vi.fn(() => false),
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('should escape backticks and single quotes', () => {
    expect(escapeHtml("test `value` 'name'")).toBe("test &#96;value&#96; &#x27;name&#x27;");
  });

  it('should return empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('isValidUUID', () => {
  it('should accept valid UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('123')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
  });
});

describe('sanitizeRequestBody', () => {
  it('should strip script tags from body strings', () => {
    const req = createMockReq({
      body: { name: 'test<script>alert(1)</script>' },
    });
    const res = createMockRes();
    const next = vi.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.name).toBe('test');
    expect(next).toHaveBeenCalled();
  });

  it('should strip javascript: protocol', () => {
    const req = createMockReq({
      body: { url: 'javascript:alert(1)' },
    });
    const res = createMockRes();
    const next = vi.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.url).not.toContain('javascript:');
    expect(next).toHaveBeenCalled();
  });

  it('should strip inline event handlers', () => {
    const req = createMockReq({
      body: { html: '<div onmouseover="alert(1)">test</div>' },
    });
    const res = createMockRes();
    const next = vi.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.html).not.toContain('onmouseover');
    expect(next).toHaveBeenCalled();
  });

  it('should handle nested objects', () => {
    const req = createMockReq({
      body: { user: { name: 'test<script>x</script>', age: 25 } },
    });
    const res = createMockRes();
    const next = vi.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.user.name).toBe('test');
    expect(req.body.user.age).toBe(25);
    expect(next).toHaveBeenCalled();
  });

  it('should handle arrays', () => {
    const req = createMockReq({
      body: { items: ['safe', '<script>bad</script>'] },
    });
    const res = createMockRes();
    const next = vi.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.items[0]).toBe('safe');
    expect(req.body.items[1]).toBe('');
    expect(next).toHaveBeenCalled();
  });

  it('should preserve non-string values', () => {
    const req = createMockReq({
      body: { count: 42, active: true, date: null },
    });
    const res = createMockRes();
    const next = vi.fn();

    sanitizeRequestBody(req, res, next);

    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.date).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});

describe('validateContentType', () => {
  it('should allow JSON content type', () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      is: vi.fn((type: string) => type === 'json'),
    });
    const res = createMockRes();
    const next = vi.fn();

    validateContentType(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject unsupported content types', () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'content-type': 'text/xml' },
      is: vi.fn(() => false),
    });
    const res = createMockRes();
    const next = vi.fn();

    validateContentType(req, res, next);

    expect(res.status).toHaveBeenCalledWith(415);
  });

  it('should skip validation for GET requests', () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    const next = vi.fn();

    validateContentType(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('validateAllParams', () => {
  it('should allow valid alphanumeric params', () => {
    const req = createMockReq({
      params: { id: '550e8400-e29b-41d4-a716-446655440000' },
    });
    const res = createMockRes();
    const next = vi.fn();

    validateAllParams(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject params with HTML characters', () => {
    const req = createMockReq({
      params: { id: '<script>alert(1)</script>' },
    });
    const res = createMockRes();
    const next = vi.fn();

    validateAllParams(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject params with SQL injection characters', () => {
    const req = createMockReq({
      params: { id: "'; DROP TABLE users;--" },
    });
    const res = createMockRes();
    const next = vi.fn();

    validateAllParams(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject overly long params', () => {
    const req = createMockReq({
      params: { id: 'a'.repeat(300) },
    });
    const res = createMockRes();
    const next = vi.fn();

    validateAllParams(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow params with hyphens and underscores', () => {
    const req = createMockReq({
      params: { slug: 'my-item_name.v2' },
    });
    const res = createMockRes();
    const next = vi.fn();

    validateAllParams(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('validateUUIDParams', () => {
  it('should allow valid UUID params', () => {
    const middleware = validateUUIDParams('id', 'jobId');
    const req = createMockReq({
      params: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        jobId: '660f9511-f3ab-52e5-b827-557766551111',
      },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject non-UUID params', () => {
    const middleware = validateUUIDParams('id');
    const req = createMockReq({
      params: { id: 'not-valid' },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow missing optional params', () => {
    const middleware = validateUUIDParams('id');
    const req = createMockReq({ params: {} });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('enforceBodyLimits', () => {
  it('should allow normal-sized body', () => {
    const req = createMockReq({
      body: { name: 'test', description: 'A normal description' },
      headers: { 'content-type': 'application/json' },
      is: vi.fn(() => false),
    });
    const res = createMockRes();
    const next = vi.fn();

    enforceBodyLimits(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject string fields exceeding max length', () => {
    const req = createMockReq({
      body: { name: 'x'.repeat(11000) },
      headers: { 'content-type': 'application/json' },
      is: vi.fn(() => false),
    });
    const res = createMockRes();
    const next = vi.fn();

    enforceBodyLimits(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow long text fields up to extended limit', () => {
    const req = createMockReq({
      body: { content: 'x'.repeat(50000) },
      headers: { 'content-type': 'application/json' },
      is: vi.fn(() => false),
    });
    const res = createMockRes();
    const next = vi.fn();

    enforceBodyLimits(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject arrays with too many elements', () => {
    const req = createMockReq({
      body: { items: new Array(1001).fill('x') },
      headers: { 'content-type': 'application/json' },
      is: vi.fn(() => false),
    });
    const res = createMockRes();
    const next = vi.fn();

    enforceBodyLimits(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject objects with too many fields', () => {
    const body: Record<string, string> = {};
    for (let i = 0; i < 201; i++) body[`field${i}`] = 'val';
    const req = createMockReq({
      body,
      headers: { 'content-type': 'application/json' },
      is: vi.fn(() => false),
    });
    const res = createMockRes();
    const next = vi.fn();

    enforceBodyLimits(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should skip multipart form data', () => {
    const req = createMockReq({
      body: { name: 'x'.repeat(50000) },
      headers: { 'content-type': 'multipart/form-data' },
      is: vi.fn((type: string) => type === 'multipart/form-data'),
    });
    const res = createMockRes();
    const next = vi.fn();

    enforceBodyLimits(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('sanitizeQueryStrings', () => {
  it('should strip script tags from query params', () => {
    const req = createMockReq({
      query: { search: 'test<script>alert(1)</script>' },
    });
    const res = createMockRes();
    const next = vi.fn();

    sanitizeQueryStrings(req, res, next);

    expect(req.query.search).toBe('test');
    expect(next).toHaveBeenCalled();
  });

  it('should strip javascript: from query params', () => {
    const req = createMockReq({
      query: { url: 'javascript:alert(1)' },
    });
    const res = createMockRes();
    const next = vi.fn();

    sanitizeQueryStrings(req, res, next);

    expect(req.query.url).not.toContain('javascript:');
    expect(next).toHaveBeenCalled();
  });

  it('should leave safe query params unchanged', () => {
    const req = createMockReq({
      query: { page: '1', search: 'hello world', status: 'ACTIVE' },
    });
    const res = createMockRes();
    const next = vi.fn();

    sanitizeQueryStrings(req, res, next);

    expect(req.query.page).toBe('1');
    expect(req.query.search).toBe('hello world');
    expect(req.query.status).toBe('ACTIVE');
    expect(next).toHaveBeenCalled();
  });
});
