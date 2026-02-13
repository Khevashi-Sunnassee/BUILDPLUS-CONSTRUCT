import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  parsePagination,
  paginatedResponse,
  parseSort,
  parseFilters,
  parseSearch,
  validateBody,
} from "../server/lib/api-utils";

function mockRequest(query: Record<string, string> = {}, params: Record<string, string> = {}): any {
  return { query, params };
}

describe("API Utilities", () => {
  describe("parsePagination", () => {
    it("should return defaults when no query params", () => {
      const result = parsePagination(mockRequest());
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it("should parse page and limit from query", () => {
      const result = parsePagination(mockRequest({ page: "3", limit: "20" }));
      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(40);
    });

    it("should enforce minimum page of 1", () => {
      const result = parsePagination(mockRequest({ page: "-5" }));
      expect(result.page).toBe(1);
    });

    it("should enforce maximum limit", () => {
      const result = parsePagination(mockRequest({ limit: "9999" }));
      expect(result.limit).toBe(200);
    });

    it("should use custom defaults", () => {
      const result = parsePagination(mockRequest(), { page: 2, limit: 10, maxLimit: 100 });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
  });

  describe("paginatedResponse", () => {
    it("should create correct pagination structure", () => {
      const items = [1, 2, 3, 4, 5];
      const result = paginatedResponse(items, 50, { page: 1, limit: 5, offset: 0 });
      expect(result.data).toEqual(items);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(10);
      expect(result.pagination.hasMore).toBe(true);
    });

    it("should indicate no more pages on last page", () => {
      const items = [1, 2, 3];
      const result = paginatedResponse(items, 23, { page: 5, limit: 5, offset: 20 });
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe("parseSort", () => {
    it("should return defaults when no query params", () => {
      const result = parseSort(mockRequest(), ["name", "createdAt"]);
      expect(result.sortBy).toBe("createdAt");
      expect(result.sortOrder).toBe("desc");
    });

    it("should parse sort parameters", () => {
      const result = parseSort(mockRequest({ sortBy: "name", sortOrder: "asc" }), ["name", "createdAt"]);
      expect(result.sortBy).toBe("name");
      expect(result.sortOrder).toBe("asc");
    });

    it("should reject invalid sort field", () => {
      const result = parseSort(mockRequest({ sortBy: "malicious_field" }), ["name", "createdAt"]);
      expect(["name", "createdAt"]).toContain(result.sortBy);
      expect(result.sortBy).not.toBe("malicious_field");
    });
  });

  describe("parseFilters", () => {
    it("should extract only allowed filters", () => {
      const result = parseFilters(
        mockRequest({ status: "ACTIVE", evil: "value", role: "ADMIN" }),
        ["status", "role"]
      );
      expect(result).toEqual({ status: "ACTIVE", role: "ADMIN" });
      expect(result).not.toHaveProperty("evil");
    });

    it("should skip empty values", () => {
      const result = parseFilters(mockRequest({ status: "", role: "USER" }), ["status", "role"]);
      expect(result).toEqual({ role: "USER" });
    });
  });

  describe("parseSearch", () => {
    it("should extract search term", () => {
      const result = parseSearch(mockRequest({ search: "  hello world  " }));
      expect(result).toBe("hello world");
    });

    it("should return undefined for empty search", () => {
      const result = parseSearch(mockRequest({ search: "   " }));
      expect(result).toBeUndefined();
    });

    it("should truncate very long search terms", () => {
      const longSearch = "a".repeat(1000);
      const result = parseSearch(mockRequest({ search: longSearch }));
      expect(result!.length).toBeLessThanOrEqual(500);
    });
  });

  describe("validateBody", () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    });

    it("should validate correct body", () => {
      const result = validateBody(schema, { name: "John", age: 30 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("John");
      }
    });

    it("should reject invalid body", () => {
      const result = validateBody(schema, { name: "", age: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.errors.length).toBeGreaterThan(0);
      }
    });

    it("should reject missing fields", () => {
      const result = validateBody(schema, {});
      expect(result.success).toBe(false);
    });
  });
});
