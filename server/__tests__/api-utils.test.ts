import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  parsePagination,
  paginatedResponse,
  parseSort,
  parseFilters,
  parseSearch,
  validateBody,
  handleValidationError,
  handleApiError,
  requireParam,
  successResponse,
  createdResponse,
  noContentResponse,
  isValidUUID,
  requireUUID,
  safeJsonParse,
} from '../lib/api-utils';
import { z } from 'zod';

function createMockReq(overrides = {}) {
  return {
    query: {},
    params: {},
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

describe('API Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default pagination when no query params', () => {
    const req = createMockReq();
    const result = parsePagination(req);
    expect(result).toEqual({ page: 1, limit: 50, offset: 0 });
  });

  it('should parse page/limit and compute offset', () => {
    const req = createMockReq({ query: { page: '3', limit: '25' } });
    const result = parsePagination(req);
    expect(result).toEqual({ page: 3, limit: 25, offset: 50 });
  });

  it('should enforce minimum page of 1 and maxLimit cap', () => {
    const req = createMockReq({ query: { page: '-5', limit: '500' } });
    const result = parsePagination(req, { maxLimit: 100 });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
  });

  it('should format paginated response with hasMore flag', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = paginatedResponse(data, 50, { page: 1, limit: 10, offset: 0 });
    expect(result.data).toEqual(data);
    expect(result.pagination.total).toBe(50);
    expect(result.pagination.totalPages).toBe(5);
    expect(result.pagination.hasMore).toBe(true);

    const lastPage = paginatedResponse([{ id: 5 }], 5, { page: 5, limit: 1, offset: 4 });
    expect(lastPage.pagination.hasMore).toBe(false);
  });

  it('should parse sort params and reject invalid fields', () => {
    const req = createMockReq({ query: { sortBy: 'name', sortOrder: 'asc' } });
    const result = parseSort(req, ['name', 'createdAt']);
    expect(result.sortBy).toBe('name');
    expect(result.sortOrder).toBe('asc');

    const badReq = createMockReq({ query: { sortBy: 'hackerField' } });
    const fallback = parseSort(badReq, ['name', 'createdAt']);
    expect(['name', 'createdAt']).toContain(fallback.sortBy);
  });

  it('should extract only allowed filters and skip empty values', () => {
    const req = createMockReq({ query: { status: 'active', role: 'admin', evil: 'drop' } });
    const result = parseFilters(req, ['status', 'role']);
    expect(result).toEqual({ status: 'active', role: 'admin' });
    expect(result).not.toHaveProperty('evil');

    const emptyReq = createMockReq({ query: { status: '' } });
    expect(parseFilters(emptyReq, ['status'])).toEqual({});
  });

  it('should parse and truncate search strings', () => {
    const req = createMockReq({ query: { search: '  hello  ' } });
    expect(parseSearch(req)).toBe('hello');

    const emptyReq = createMockReq({ query: { search: '  ' } });
    expect(parseSearch(emptyReq)).toBeUndefined();

    const longReq = createMockReq({ query: { search: 'a'.repeat(600) } });
    expect(parseSearch(longReq)!.length).toBe(500);
  });

  it('should validate body with zod schema', () => {
    const schema = z.object({ name: z.string() });
    const good = validateBody(schema, { name: 'Test' });
    expect(good.success).toBe(true);

    const bad = validateBody(schema, { name: 123 });
    expect(bad.success).toBe(false);
  });

  it('should validate and reject invalid UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('')).toBe(false);
  });

  it('should return param or null with 400 for missing param', () => {
    const res1 = createMockRes();
    expect(requireParam(createMockReq({ params: { id: 'abc' } }), res1, 'id')).toBe('abc');

    const res2 = createMockRes();
    expect(requireParam(createMockReq({ params: {} }), res2, 'id')).toBeNull();
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it('should return valid UUID or null with 400 for invalid', () => {
    const res1 = createMockRes();
    expect(requireUUID(createMockReq({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } }), res1, 'id'))
      .toBe('550e8400-e29b-41d4-a716-446655440000');

    const res2 = createMockRes();
    expect(requireUUID(createMockReq({ params: { id: 'bad' } }), res2, 'id')).toBeNull();
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it('should safely parse JSON with optional fallback', () => {
    const good = safeJsonParse('{"key":"value"}');
    expect(good.success).toBe(true);

    const bad = safeJsonParse('not json');
    expect(bad.success).toBe(false);

    const fallback = safeJsonParse('not json', { default: true });
    expect(fallback.success).toBe(true);
  });

  it('should send correct status codes for response helpers', () => {
    const res1 = createMockRes();
    successResponse(res1, { ok: true });
    expect(res1.status).toHaveBeenCalledWith(200);

    const res2 = createMockRes();
    createdResponse(res2, { id: 1 });
    expect(res2.status).toHaveBeenCalledWith(201);

    const res3 = createMockRes();
    noContentResponse(res3);
    expect(res3.status).toHaveBeenCalledWith(204);
    expect(res3.end).toHaveBeenCalled();
  });

  it('should handle API errors by logging and returning 500', () => {
    const res = createMockRes();
    handleApiError(res, new Error('boom'), 'test-context');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('should format validation errors with field details', () => {
    const schema = z.object({ name: z.string() });
    const parseResult = schema.safeParse({ name: 123 });
    if (!parseResult.success) {
      const res = createMockRes();
      handleValidationError(res, parseResult.error);
      expect(res.status).toHaveBeenCalledWith(400);
      const call = res.json.mock.calls[0][0];
      expect(call.error).toBe('Validation failed');
      expect(call.details).toBeDefined();
      expect(call.details[0].field).toBe('name');
    }
  });
});
