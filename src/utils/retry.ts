import { sleep } from "./sleep";

export interface RetryOptions {
  retries: number;
  initialDelay: number;
  factor?: number;
  onRetry?: (error: any, attempt: number) => void;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { retries, initialDelay, factor = 2, onRetry } = options;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt > retries) {
        throw error;
      }
      if (onRetry) {
        onRetry(error, attempt);
      }
      await sleep(delay);
      delay *= factor;
    }
  }

  throw new Error('Retry logic failed unexpectedly');
}
