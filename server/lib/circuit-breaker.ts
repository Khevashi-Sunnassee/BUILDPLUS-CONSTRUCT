import logger from "./logger";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

interface CircuitStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: string | null;
  lastSuccess: string | null;
  totalRequests: number;
  totalFailures: number;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private successes = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private halfOpenAttempts = 0;
  private totalRequests = 0;
  private totalFailures = 0;

  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;
    this.onStateChange = options.onStateChange;
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === "OPEN") {
      if (Date.now() - (this.lastFailureTime?.getTime() || 0) > this.resetTimeoutMs) {
        this.transition("HALF_OPEN");
      } else {
        logger.warn({ circuit: this.name }, `Circuit breaker OPEN — rejecting request`);
        if (fallback) return fallback();
        throw new Error(`Circuit breaker ${this.name} is OPEN — service unavailable`);
      }
    }

    if (this.state === "HALF_OPEN" && this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
      if (fallback) return fallback();
      throw new Error(`Circuit breaker ${this.name} is HALF_OPEN — max attempts reached`);
    }

    try {
      if (this.state === "HALF_OPEN") {
        this.halfOpenAttempts++;
      }
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();

    if (this.state === "HALF_OPEN") {
      this.transition("CLOSED");
      this.failures = 0;
      this.halfOpenAttempts = 0;
    } else if (this.state === "CLOSED") {
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  private onFailure(): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = new Date();

    if (this.state === "HALF_OPEN") {
      this.transition("OPEN");
      this.halfOpenAttempts = 0;
    } else if (this.state === "CLOSED" && this.failures >= this.failureThreshold) {
      this.transition("OPEN");
    }
  }

  private transition(to: CircuitState): void {
    const from = this.state;
    this.state = to;
    logger.info({ circuit: this.name, from, to }, `Circuit breaker state change`);
    this.onStateChange?.(from, to);
  }

  getStats(): CircuitStats {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailureTime?.toISOString() || null,
      lastSuccess: this.lastSuccessTime?.toISOString() || null,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
    };
  }

  reset(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.successes = 0;
    this.halfOpenAttempts = 0;
  }
}

export const openAIBreaker = new CircuitBreaker({
  name: "openai",
  failureThreshold: 3,
  resetTimeoutMs: 60000,
  halfOpenMaxAttempts: 2,
});

export const twilioBreaker = new CircuitBreaker({
  name: "twilio",
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
});

export const mailgunBreaker = new CircuitBreaker({
  name: "mailgun",
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
});

export function getAllCircuitStats() {
  return [openAIBreaker, twilioBreaker, mailgunBreaker].map(b => b.getStats());
}
