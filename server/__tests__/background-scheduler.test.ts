import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('BackgroundScheduler', () => {
  let scheduler: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../lib/background-scheduler');
    scheduler = mod.scheduler;
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('should export a scheduler singleton', () => {
    expect(scheduler).toBeDefined();
    expect(typeof scheduler.register).toBe('function');
    expect(typeof scheduler.start).toBe('function');
    expect(typeof scheduler.stop).toBe('function');
  });

  it('should register a job', () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.register('test-job', fn, 60000);
    const status = scheduler.getStatus();
    expect(status['test-job']).toBeDefined();
    expect(status['test-job'].intervalMs).toBe(60000);
    expect(status['test-job'].runCount).toBe(0);
  });

  it('should not register duplicate jobs', () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.register('dup-job', fn, 60000);
    scheduler.register('dup-job', fn, 30000);
    const status = scheduler.getStatus();
    expect(status['dup-job'].intervalMs).toBe(60000);
  });

  it('should start and schedule jobs', () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.register('delayed-job', fn, 60000);
    scheduler.start();

    const status = scheduler.getStatus();
    expect(status['delayed-job']).toBeDefined();
    expect(status['delayed-job'].intervalMs).toBe(60000);
  });

  it('should not start twice', () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.register('once-job', fn, 60000);
    scheduler.start();
    scheduler.start();

    const status = scheduler.getStatus();
    expect(status['once-job']).toBeDefined();
  });

  it('should stop all jobs and prevent execution', () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.register('stop-job', fn, 60000);
    scheduler.start();
    scheduler.stop();

    vi.advanceTimersByTime(120000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should return false when triggering non-existent job', async () => {
    const result = await scheduler.triggerNow('nonexistent-job');
    expect(result).toBe(false);
  });

  it('should report isJobRunning as false initially', () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.register('running-check', fn, 60000);
    expect(scheduler.isJobRunning('running-check')).toBe(false);
  });

  it('should return false for isJobRunning on nonexistent job', () => {
    expect(scheduler.isJobRunning('nonexistent')).toBe(false);
  });

  it('should return full status for all registered jobs', () => {
    scheduler.register('a', vi.fn().mockResolvedValue(undefined), 10000);
    scheduler.register('b', vi.fn().mockResolvedValue(undefined), 20000);

    const status = scheduler.getStatus();
    expect(Object.keys(status)).toContain('a');
    expect(Object.keys(status)).toContain('b');
    expect(status['a'].isRunning).toBe(false);
    expect(status['b'].isRunning).toBe(false);
  });

  it('should include all expected fields in job status', () => {
    scheduler.register('fields-job', vi.fn().mockResolvedValue(undefined), 30000);
    const status = scheduler.getStatus();
    const job = status['fields-job'];
    expect(job).toHaveProperty('isRunning');
    expect(job).toHaveProperty('lastRun');
    expect(job).toHaveProperty('lastError');
    expect(job).toHaveProperty('lastDurationMs');
    expect(job).toHaveProperty('runCount');
    expect(job).toHaveProperty('errorCount');
    expect(job).toHaveProperty('intervalMs');
    expect(job).toHaveProperty('nextRunEstimate');
  });

  it('should have null lastRun before any execution', () => {
    scheduler.register('no-run', vi.fn().mockResolvedValue(undefined), 60000);
    const status = scheduler.getStatus();
    expect(status['no-run'].lastRun).toBeNull();
    expect(status['no-run'].lastDurationMs).toBeNull();
    expect(status['no-run'].lastError).toBeNull();
  });

  it('should initialize runCount and errorCount to zero', () => {
    scheduler.register('zero-counts', vi.fn().mockResolvedValue(undefined), 60000);
    const status = scheduler.getStatus();
    expect(status['zero-counts'].runCount).toBe(0);
    expect(status['zero-counts'].errorCount).toBe(0);
  });

  it('should trigger a registered job and return true', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.register('trigger-job', fn, 60000);

    const result = await scheduler.triggerNow('trigger-job');
    expect(result).toBe(true);
  });
});
