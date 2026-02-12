import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobQueue } from '../lib/job-queue';

describe('JobQueue', () => {
  let queue: JobQueue;

  beforeEach(() => {
    queue = new JobQueue({
      name: 'test',
      concurrency: 2,
      maxRetries: 2,
      retryDelayMs: 100,
      maxQueueSize: 5,
    });
  });

  it('should register handlers and enqueue jobs', async () => {
    const results: string[] = [];
    queue.register('test-job', async (data: { msg: string }) => {
      results.push(data.msg);
    });

    queue.enqueue('test-job', { msg: 'hello' });
    await new Promise(r => setTimeout(r, 100));
    expect(results).toContain('hello');
  });

  it('should throw when enqueueing without handler', () => {
    expect(() => queue.enqueue('unknown-type', {})).toThrow('No handler registered');
  });

  it('should track stats correctly', async () => {
    queue.register('task', async () => {});
    queue.enqueue('task', {});
    await new Promise(r => setTimeout(r, 100));
    const stats = queue.getStats();
    expect(stats.name).toBe('test');
    expect(stats.processed).toBe(1);
  });

  it('should retry failed jobs', async () => {
    let attempts = 0;
    queue.register('flaky', async () => {
      attempts++;
      if (attempts < 2) throw new Error('transient');
    });

    queue.enqueue('flaky', {});
    await new Promise(r => setTimeout(r, 500));
    expect(attempts).toBeGreaterThanOrEqual(2);
    const stats = queue.getStats();
    expect(stats.processed).toBe(1);
  });

  it('should permanently fail after max retries', async () => {
    queue.register('always-fail', async () => {
      throw new Error('permanent failure');
    });

    queue.enqueue('always-fail', {});
    await new Promise(r => setTimeout(r, 1000));
    const stats = queue.getStats();
    expect(stats.failed).toBe(1);
  });

  it('should respect concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    queue.register('slow', async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(r => setTimeout(r, 100));
      concurrent--;
    });

    for (let i = 0; i < 5; i++) {
      queue.enqueue('slow', {});
    }
    await new Promise(r => setTimeout(r, 600));
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should process higher priority jobs first', async () => {
    const order: number[] = [];
    queue.register('priority', async (data: { priority: number }) => {
      order.push(data.priority);
    });

    queue = new JobQueue({ name: 'priority-test', concurrency: 1, maxRetries: 1, retryDelayMs: 100, maxQueueSize: 10 });
    queue.register('priority', async (data: { priority: number }) => {
      order.push(data.priority);
      await new Promise(r => setTimeout(r, 50));
    });

    queue.enqueue('priority', { priority: 1 }, 1);
    queue.enqueue('priority', { priority: 10 }, 10);
    queue.enqueue('priority', { priority: 5 }, 5);

    await new Promise(r => setTimeout(r, 500));
    expect(order[0]).toBe(10);
  });

  it('should drain pending jobs', async () => {
    queue.register('drain-test', async () => {
      await new Promise(r => setTimeout(r, 1000));
    });

    for (let i = 0; i < 4; i++) {
      queue.enqueue('drain-test', {});
    }
    queue.drain();
    const stats = queue.getStats();
    expect(stats.queueSize).toBeLessThanOrEqual(2);
  });

  it('should get job status by id', () => {
    queue.register('status', async () => {});
    const id = queue.enqueue('status', {});
    const job = queue.getJobStatus(id);
    expect(job).toBeDefined();
    expect(job?.type).toBe('status');
  });
});
