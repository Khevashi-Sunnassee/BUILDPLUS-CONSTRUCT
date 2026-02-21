import express from "express";
import { vi } from "vitest";

export function createTestApp() {
  const app = express();
  app.use(express.json());
  return app;
}

export function mockAuthMiddleware(userId = "test-user-1", companyId = "test-company-1", role = "ADMIN") {
  return (req: any, _res: any, next: any) => {
    req.session = { userId };
    req.companyId = companyId;
    req.user = { id: userId, role, companyId };
    next();
  };
}

export function createMockStorage() {
  return {
    getUser: vi.fn().mockResolvedValue({ id: "test-user-1", name: "Test", email: "test@test.com", role: "ADMIN", companyId: "test-company-1" }),
    getAllDevices: vi.fn().mockResolvedValue([]),
    getDevice: vi.fn(),
    createDevice: vi.fn().mockResolvedValue({ device: { id: "d1" }, deviceKey: "key1" }),
    updateDevice: vi.fn(),
    deleteDevice: vi.fn(),
    getActiveWorkTypes: vi.fn().mockResolvedValue([]),
    getAllWorkTypes: vi.fn().mockResolvedValue([]),
    createWorkType: vi.fn(),
    updateWorkType: vi.fn(),
    deleteWorkType: vi.fn(),
    getActiveTrailerTypes: vi.fn().mockResolvedValue([]),
    getAllTrailerTypes: vi.fn().mockResolvedValue([]),
    getDocuments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  };
}
