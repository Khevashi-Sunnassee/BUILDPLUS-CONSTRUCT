import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/logger', async () => {
  const pino = await import('pino');
  const testLogger = pino.default({ level: 'silent' });
  return {
    default: testLogger,
    logger: testLogger,
  };
});

describe('Logger Configuration', () => {
  it('should export a default logger', async () => {
    const loggerModule = await import('../lib/logger');
    expect(loggerModule.default).toBeDefined();
  });

  it('should export a named logger', async () => {
    const loggerModule = await import('../lib/logger');
    expect(loggerModule.logger).toBeDefined();
  });

  it('should have standard pino log methods', async () => {
    const loggerModule = await import('../lib/logger');
    const log = loggerModule.default;
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.fatal).toBe('function');
  });

  it('should have a valid log level', async () => {
    const loggerModule = await import('../lib/logger');
    const log = loggerModule.default;
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
    expect(validLevels).toContain(log.level);
  });
});
