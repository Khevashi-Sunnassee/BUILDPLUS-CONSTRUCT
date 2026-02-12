import { describe, it, expect } from 'vitest';
import { insertUserSchema, insertJobSchema } from '@shared/schema';

describe('Input Validation Schemas', () => {
  describe('insertUserSchema', () => {
    it('should accept valid user data', () => {
      const validUser = {
        companyId: 'company-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      };

      const result = insertUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('should require companyId', () => {
      const invalidUser = {
        email: 'test@example.com',
        name: 'Test User',
      };

      const result = insertUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should require email', () => {
      const invalidUser = {
        companyId: 'company-123',
        name: 'Test User',
      };

      const result = insertUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should not allow id field (auto-generated)', () => {
      const userWithId = {
        id: 'manual-id',
        companyId: 'company-123',
        email: 'test@example.com',
      };

      const result = insertUserSchema.safeParse(userWithId);
      if (result.success) {
        expect((result.data as any).id).toBeUndefined();
      }
    });

    it('should not allow createdAt field (auto-generated)', () => {
      const userWithTimestamp = {
        companyId: 'company-123',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      const result = insertUserSchema.safeParse(userWithTimestamp);
      if (result.success) {
        expect((result.data as any).createdAt).toBeUndefined();
      }
    });
  });

  describe('insertJobSchema', () => {
    it('should accept valid job data', () => {
      const validJob = {
        companyId: 'company-123',
        jobNumber: 'JOB-001',
        name: 'Test Job',
      };

      const result = insertJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
    });

    it('should require companyId', () => {
      const invalidJob = {
        jobNumber: 'JOB-001',
        name: 'Test Job',
      };

      const result = insertJobSchema.safeParse(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should require jobNumber', () => {
      const invalidJob = {
        companyId: 'company-123',
        name: 'Test Job',
      };

      const result = insertJobSchema.safeParse(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should require name', () => {
      const invalidJob = {
        companyId: 'company-123',
        jobNumber: 'JOB-001',
      };

      const result = insertJobSchema.safeParse(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should not allow id field (auto-generated)', () => {
      const jobWithId = {
        id: 'manual-id',
        companyId: 'company-123',
        jobNumber: 'JOB-001',
        name: 'Test Job',
      };

      const result = insertJobSchema.safeParse(jobWithId);
      if (result.success) {
        expect((result.data as any).id).toBeUndefined();
      }
    });

    it('should accept optional fields', () => {
      const jobWithOptionals = {
        companyId: 'company-123',
        jobNumber: 'JOB-002',
        name: 'Full Job',
        client: 'Test Client',
        address: '123 Test St',
        city: 'Sydney',
        description: 'A test job',
      };

      const result = insertJobSchema.safeParse(jobWithOptionals);
      expect(result.success).toBe(true);
    });

    it('should return errors with proper messages for invalid data', () => {
      const result = insertJobSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        const fieldNames = result.error.issues.map(i => i.path[0]);
        expect(fieldNames).toContain('companyId');
        expect(fieldNames).toContain('jobNumber');
        expect(fieldNames).toContain('name');
      }
    });
  });
});
