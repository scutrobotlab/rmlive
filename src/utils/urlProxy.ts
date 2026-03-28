const LIVEJSON_PROXY_ENV = String(import.meta.env.VITE_LIVEJSON_PROXY ?? '').trim();
const IMG_PROXY_ENV = String(import.meta.env.VITE_IMG_PROXY ?? '').trim();

export function hasLiveJsonProxy(): boolean {
  return LIVEJSON_PROXY_ENV.length > 0;
}

export function hasImageProxy(): boolean {
  return IMG_PROXY_ENV.length > 0;
}

function buildImageProxyUrl(rawUrl: string): string {
  if (!rawUrl || !hasImageProxy()) {
    return rawUrl;
  }

  if (rawUrl.startsWith(IMG_PROXY_ENV)) {
    return rawUrl;
  }

  return `${IMG_PROXY_ENV}/${rawUrl}`;
}

function buildLiveJsonProxyUrl(rawUrl: string): string {
  if (!rawUrl) {
    return rawUrl;
  }

  const liveJsonMatch = rawUrl.match(/^\/live_json\/(.*?)(?:\?|$)/);
  if (!liveJsonMatch) {
    return rawUrl;
  }

  const pathPart = liveJsonMatch[1];

  if (hasLiveJsonProxy()) {
    return `${LIVEJSON_PROXY_ENV}/${pathPart}`;
  }

  return `https://rm-static.djicdn.com/live_json/${pathPart}`;
}

function shouldBypassStaticProxy(rawUrl: string): boolean {
  return /[?&]noproxy=1(?:&|$)/.test(rawUrl);
}

export function appendNoCache(url: string): string {
  if (!url) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ts=${Date.now()}`;
}

export function buildLiveJsonUrl(rawUrl: string): string {
  if (!hasLiveJsonProxy() || shouldBypassStaticProxy(rawUrl)) {
    return rawUrl;
  }

  return buildLiveJsonProxyUrl(rawUrl);
}

export function buildImageUrl(rawUrl: string): string {
  return buildImageProxyUrl(rawUrl);
}
