import { describe, it, expect, vi } from 'vitest';
import {
  sendSuccess, sendCreated, sendNoContent, sendError,
  sendBadRequest, sendUnauthorized, sendForbidden, sendNotFound,
  sendConflict, sendTooManyRequests, sendServerError, sendPaginated,
} from '../lib/api-response';

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

describe('API Response Helpers', () => {
  it('sendSuccess returns 200 with data', () => {
    const res = createMockRes();
    sendSuccess(res, { id: '1', name: 'test' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: '1', name: 'test' });
  });

  it('sendSuccess accepts custom status code', () => {
    const res = createMockRes();
    sendSuccess(res, { ok: true }, 202);
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('sendCreated returns 201 with data', () => {
    const res = createMockRes();
    sendCreated(res, { id: '2' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: '2' });
  });

  it('sendNoContent returns 204 with no body', () => {
    const res = createMockRes();
    sendNoContent(res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('sendBadRequest returns 400 with default message', () => {
    const res = createMockRes();
    sendBadRequest(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Bad request' });
  });

  it('sendBadRequest returns 400 with custom message', () => {
    const res = createMockRes();
    sendBadRequest(res, 'Name is required');
    expect(res.json).toHaveBeenCalledWith({ error: 'Name is required' });
  });

  it('sendUnauthorized returns 401', () => {
    const res = createMockRes();
    sendUnauthorized(res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('sendForbidden returns 403', () => {
    const res = createMockRes();
    sendForbidden(res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
  });

  it('sendNotFound returns 404', () => {
    const res = createMockRes();
    sendNotFound(res, 'Job not found');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Job not found' });
  });

  it('sendConflict returns 409', () => {
    const res = createMockRes();
    sendConflict(res, 'Duplicate entry');
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Duplicate entry' });
  });

  it('sendTooManyRequests returns 429', () => {
    const res = createMockRes();
    sendTooManyRequests(res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too many requests, please try again later' });
  });

  it('sendServerError returns 500', () => {
    const res = createMockRes();
    sendServerError(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('sendError returns custom status code and message', () => {
    const res = createMockRes();
    sendError(res, 422, 'Unprocessable entity');
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unprocessable entity' });
  });

  it('sendPaginated returns paginated response with correct structure', () => {
    const res = createMockRes();
    const items = [{ id: 1 }, { id: 2 }];
    sendPaginated(res, items, { page: 1, limit: 10, total: 25 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: items,
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    });
  });

  it('sendPaginated calculates totalPages correctly', () => {
    const res = createMockRes();
    sendPaginated(res, [], { page: 1, limit: 10, total: 10 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      pagination: expect.objectContaining({ totalPages: 1 }),
    }));
  });

  it('sendPaginated handles zero total', () => {
    const res = createMockRes();
    sendPaginated(res, [], { page: 1, limit: 10, total: 0 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      pagination: expect.objectContaining({ totalPages: 0 }),
    }));
  });
});
