const STATIC_PROXY_ENV = String(import.meta.env.VITE_STATIC_PROXY ?? '').trim();
const PROXY_BASE = STATIC_PROXY_ENV;

export function hasStaticProxy(): boolean {
  return PROXY_BASE.length > 0;
}

export function buildStaticProxyUrl(rawUrl: string): string {
  if (!rawUrl || !hasStaticProxy()) {
    return rawUrl;
  }

  if (rawUrl.startsWith(PROXY_BASE)) {
    return rawUrl;
  }

  return `${PROXY_BASE}/${rawUrl}`;
}

export function appendNoCache(url: string): string {
  if (!url) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ts=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildLiveJsonUrl(rawUrl: string): string {
  const proxied = buildStaticProxyUrl(rawUrl);
  if (!hasStaticProxy()) {
    return proxied;
  }

  return appendNoCache(proxied);
}

export function buildImageUrl(rawUrl: string): string {
  return buildStaticProxyUrl(rawUrl);
}
