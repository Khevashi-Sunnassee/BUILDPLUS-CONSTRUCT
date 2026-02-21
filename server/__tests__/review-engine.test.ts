import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
  })),
}));

vi.mock('../lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { sanitizeContent, generatePacket, packetToMarkdown, mergeTaskpacks } from '../services/review-engine';

describe('Review Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeContent', () => {
    it('should redact API keys starting with sk-', () => {
      const input = 'My key is sk-abcdefghij1234567890abc';
      const result = sanitizeContent(input);
      expect(result).not.toContain('sk-abcdefghij1234567890abc');
      expect(result).toContain('[REDACTED]');
    });

    it('should redact session tokens starting with sess_', () => {
      const input = 'Token: sess_abc123def456';
      const result = sanitizeContent(input);
      expect(result).not.toContain('sess_abc123def456');
    });

    it('should redact webhook secrets starting with whsec_', () => {
      const input = 'Secret: whsec_longTokenValue123';
      const result = sanitizeContent(input);
      expect(result).not.toContain('whsec_longTokenValue123');
    });

    it('should redact resend keys starting with re_', () => {
      const input = 'Resend: re_someApiKeyValue123';
      const result = sanitizeContent(input);
      expect(result).not.toContain('re_someApiKeyValue123');
    });

    it('should redact process.env references', () => {
      const input = 'Using process.env.DATABASE_URL in the app';
      const result = sanitizeContent(input);
      expect(result).not.toContain('process.env.DATABASE_URL');
      expect(result).toContain('[REDACTED]');
    });

    it('should redact long quoted tokens', () => {
      const longToken = 'A'.repeat(40);
      const input = `secret = "${longToken}"`;
      const result = sanitizeContent(input);
      expect(result).toContain('[REDACTED_TOKEN]');
    });

    it('should leave normal text unchanged', () => {
      const input = 'This is a normal string with no secrets';
      const result = sanitizeContent(input);
      expect(result).toBe(input);
    });

    it('should handle empty string', () => {
      expect(sanitizeContent('')).toBe('');
    });

    it('should redact email addresses', () => {
      const input = 'Contact me at admin@company.com for details';
      const result = sanitizeContent(input);
      expect(result).not.toContain('admin@company.com');
    });
  });

  describe('packetToMarkdown', () => {
    it('should generate markdown from packet data', () => {
      const packet = {
        target: {
          routePath: '/dashboard',
          targetType: 'page',
          pageTitle: 'Dashboard',
          module: 'core',
          frontendEntryFile: 'client/src/pages/dashboard.tsx',
          relatedFiles: ['client/src/lib/utils.ts'],
        },
        ui: {
          purpose: 'Main dashboard view',
          roles: ['ADMIN', 'USER'],
          keyUserFlows: ['View stats'],
          knownIssues: [],
          riskFocus: ['SECURITY'],
        },
        frontend: {
          files: [{ path: 'client/src/pages/dashboard.tsx', loc: 150 }],
          reactQuery: { queries: [], mutations: [] },
          forms: [],
          permissionGuards: [],
        },
        backend: {
          endpointsUsed: [],
          tablesTouched: ['users'],
          externalServicesTouched: [],
        },
        notes: {
          sanitization: 'PII redacted',
          generatedAt: '2026-02-21T00:00:00.000Z',
        },
      };

      const md = packetToMarkdown(packet);
      expect(md).toContain('# Review Packet: Dashboard');
      expect(md).toContain('**Route:** /dashboard');
      expect(md).toContain('**Module:** core');
      expect(md).toContain('ADMIN');
      expect(md).toContain('View stats');
    });
  });

  describe('mergeTaskpacks', () => {
    it('should merge findings from two reviewers', () => {
      const runA = {
        responseJson: {
          findings: [
            { severity: 'P0', category: 'SECURITY', title: 'SQL Injection', detail_md: 'details' },
          ],
        },
        reviewer: 'REPLIT_CLAUDE',
      };
      const runB = {
        responseJson: {
          findings: [
            { severity: 'P2', category: 'PERFORMANCE', title: 'N+1 query', detail_md: 'slow' },
          ],
        },
        reviewer: 'OPENAI',
      };

      const result = mergeTaskpacks(runA, runB);
      expect(result.mergedTasksJson.totalFindings).toBe(2);
      expect(result.mergedTasksJson.bySeverity.P0).toBe(1);
      expect(result.mergedTasksJson.bySeverity.P2).toBe(1);
      expect(result.mergedTasksMd).toContain('SQL Injection');
      expect(result.mergedTasksMd).toContain('N+1 query');
    });

    it('should handle null runs', () => {
      const result = mergeTaskpacks(null, null);
      expect(result.mergedTasksJson.totalFindings).toBe(0);
    });

    it('should sort findings by severity', () => {
      const runA = {
        responseJson: {
          findings: [
            { severity: 'P3', category: 'UX', title: 'Minor UI' },
            { severity: 'P0', category: 'SECURITY', title: 'Critical bug' },
            { severity: 'P1', category: 'RBAC', title: 'Role issue' },
          ],
        },
        reviewer: 'OPENAI',
      };

      const result = mergeTaskpacks(runA, null);
      const findings = result.mergedTasksJson.findings;
      expect(findings[0].severity).toBe('P0');
      expect(findings[1].severity).toBe('P1');
      expect(findings[2].severity).toBe('P3');
    });
  });
});
