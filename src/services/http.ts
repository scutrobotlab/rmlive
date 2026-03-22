export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export class HttpError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 600;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      if (!response.ok) {
        throw new HttpError(`Request failed with status ${response.status}`, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }

      const backoff = retryDelayMs * (attempt + 1);
      await delay(backoff);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new HttpError('Unexpected request state');
}
