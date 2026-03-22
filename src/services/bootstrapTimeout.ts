export interface BootstrapTimeoutOptions {
  totalTimeoutMs: number;
  perRequestTimeoutMs: number;
  minRemainingTimeoutMs?: number;
}

export function createBootstrapTimeoutRunner(startTime: number, options: BootstrapTimeoutOptions) {
  const { totalTimeoutMs, perRequestTimeoutMs, minRemainingTimeoutMs = 1000 } = options;

  return function withBootstrapTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(minRemainingTimeoutMs, totalTimeoutMs - elapsedTime);
      const timeout = Math.min(perRequestTimeoutMs, remainingTime);

      const timer = setTimeout(() => reject(new Error('bootstrap timeout')), timeout);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  };
}
