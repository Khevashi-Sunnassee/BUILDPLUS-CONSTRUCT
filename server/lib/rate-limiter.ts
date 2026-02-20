import logger from "./logger";

export class TokenBucketRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private lastRefill: number;
  private readonly name: string;
  private waiting: Array<{ resolve: () => void; enqueueTime: number }> = [];
  private drainTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: {
    name: string;
    maxTokens: number;
    refillRatePerSecond: number;
  }) {
    this.name = options.name;
    this.maxTokens = options.maxTokens;
    this.tokens = options.maxTokens;
    this.refillRate = options.refillRatePerSecond;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push({ resolve, enqueueTime: Date.now() });
      this.scheduleDrain();
    });
  }

  private scheduleDrain(): void {
    if (this.drainTimer) return;

    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate * 1000);
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      this.refill();

      while (this.waiting.length > 0 && this.tokens >= 1) {
        const next = this.waiting.shift();
        if (next) {
          this.tokens -= 1;
          const waitedMs = Date.now() - next.enqueueTime;
          if (waitedMs > 2000) {
            logger.debug({ limiter: this.name, waitedMs }, "Rate limiter released after wait");
          }
          next.resolve();
        }
      }

      if (this.waiting.length > 0) {
        this.scheduleDrain();
      }
    }, Math.max(waitMs, 50));
  }

  getStats(): {
    name: string;
    tokens: number;
    maxTokens: number;
    waitingCount: number;
    refillRatePerSecond: number;
  } {
    this.refill();
    return {
      name: this.name,
      tokens: Math.floor(this.tokens * 100) / 100,
      maxTokens: this.maxTokens,
      waitingCount: this.waiting.length,
      refillRatePerSecond: this.refillRate,
    };
  }

  destroy(): void {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = null;
    }
    for (const w of this.waiting) {
      w.resolve();
    }
    this.waiting = [];
  }
}

export const resendRateLimiter = new TokenBucketRateLimiter({
  name: "resend",
  maxTokens: 2,
  refillRatePerSecond: 1.8,
});
