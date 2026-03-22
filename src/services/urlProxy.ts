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
  return `${url}${separator}_ts=${Date.now()}`;
}

export function buildLiveJsonUrl(rawUrl: string): string {
  if (!hasStaticProxy()) {
    return appendNoCache(rawUrl);
  }

  const ts = Date.now();

  // 关键：把 no-cache 参数写进被代理 URL 本体，适配 /static/*URL 取参逻辑。
  // 由于 *URL 位于路径中，需要把 ? 与 & 编码进路径，避免被当成外层 query。
  const embeddedNoCacheSuffix = `%3F_ts%3D${ts}`;
  const proxiedWithEmbeddedNoCache = buildStaticProxyUrl(`${rawUrl}${embeddedNoCacheSuffix}`);

  // 保留外层参数作为兜底，兼容不同代理实现。
  return appendNoCache(proxiedWithEmbeddedNoCache);
}

export function buildImageUrl(rawUrl: string): string {
  return buildStaticProxyUrl(rawUrl);
}
