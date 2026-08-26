export type Clock = () => number;
export type Sleep = (ms: number) => Promise<void>;
export type Random = () => number;

export type PacerOptions = {
  minIntervalMs?: number;
  jitterMs?: number;
  now?: Clock;
  sleep?: Sleep;
  random?: Random;
};

export type Pacer = {
  wait(): Promise<void>;
};

export type CooldownOptions = {
  now?: Clock;
};

export type Cooldown = {
  block(key: string, ms: number): void;
  remaining(key: string): number;
  clear(key: string): void;
};

export const MIN_REQUEST_INTERVAL_MS = 400;
export const REQUEST_JITTER_MS = 220;
export const RATE_LIMIT_COOLDOWN_MS = 90_000;
export const MAX_COOLDOWN_MS = 10 * 60_000;

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Spaces outgoing requests and adds jitter, so a burst of clicks does not
 * arrive as a machine-perfect series of identical intervals.
 */
export function createPacer({
  minIntervalMs = MIN_REQUEST_INTERVAL_MS,
  jitterMs = REQUEST_JITTER_MS,
  now = Date.now,
  sleep = defaultSleep,
  random = Math.random,
}: PacerOptions = {}): Pacer {
  let nextAllowedAt = 0;

  return {
    async wait() {
      const jitter = Math.round(random() * jitterMs);
      const currentTime = now();
      const delay = Math.max(0, nextAllowedAt - currentTime) + jitter;

      nextAllowedAt = currentTime + delay + minIntervalMs;

      if (delay > 0) {
        await sleep(delay);
      }
    },
  };
}

export function createCooldown({ now = Date.now }: CooldownOptions = {}): Cooldown {
  const blockedUntil = new Map<string, number>();

  return {
    block(key, ms) {
      const until = now() + Math.min(MAX_COOLDOWN_MS, Math.max(0, ms));
      blockedUntil.set(key, Math.max(until, blockedUntil.get(key) || 0));
    },
    remaining(key) {
      const until = blockedUntil.get(key);

      if (!until) {
        return 0;
      }

      const left = until - now();

      if (left <= 0) {
        blockedUntil.delete(key);
        return 0;
      }

      return left;
    },
    clear(key) {
      blockedUntil.delete(key);
    },
  };
}

/** `Retry-After` arrives either as seconds or as an HTTP date. */
export function parseRetryAfterMs(
  headerValue: unknown,
  now: Clock = Date.now,
): number {
  if (typeof headerValue !== "string") {
    return 0;
  }

  const trimmed = headerValue.trim();

  if (!trimmed) {
    return 0;
  }

  const seconds = Number(trimmed);

  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.min(MAX_COOLDOWN_MS, Math.round(seconds * 1000)));
  }

  const timestamp = Date.parse(trimmed);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.min(MAX_COOLDOWN_MS, timestamp - now()));
}

/** Exponential backoff with jitter, so retries never line up exactly. */
export function getBackoffMs(
  attempt: number,
  retryAfterMs = 0,
  random: Random = Math.random,
): number {
  const base = 350 * 2 ** Math.max(0, attempt);
  const jitter = Math.round(random() * base * 0.5);

  return Math.max(retryAfterMs, Math.min(4_000, base + jitter));
}

export function formatCooldownHint(remainingMs: number): string {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));

  if (seconds < 60) {
    return `${seconds} сек.`;
  }

  return `${Math.ceil(seconds / 60)} мин.`;
}
