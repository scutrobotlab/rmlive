const LIVEJSON_PROXY_ENV = String(import.meta.env.VITE_LIVEJSON_PROXY ?? '').trim();
const IMG_PROXY_ENV = String(import.meta.env.VITE_IMG_PROXY ?? '').trim();
const RM_STATIC_CDN = 'https://rm-static.djicdn.com';

function hasLiveJsonProxy(): boolean {
  return LIVEJSON_PROXY_ENV.length > 0;
}

export function buildLiveJsonUrl(rawUrl: string): string {
  if (!rawUrl) {
    return rawUrl;
  }

  if (!hasLiveJsonProxy() || /[?&]noproxy=1(?:&|$)/.test(rawUrl)) {
    return rawUrl;
  }

  const match = rawUrl.match(/^\/live_json\/(.*?)(?:\?|$)/);
  if (!match) {
    return rawUrl;
  }

  return `${LIVEJSON_PROXY_ENV}/${match[1]}`;
}

export function getScheduleJsonUrl(): string {
  return buildLiveJsonUrl('/live_json/schedule.json');
}

export function buildImageUrl(rawUrl: string): string {
  if (!rawUrl || !IMG_PROXY_ENV) {
    return rawUrl;
  }

  if (rawUrl.startsWith(IMG_PROXY_ENV)) {
    return rawUrl;
  }

  return `${IMG_PROXY_ENV}/${rawUrl}`;
}

export function appendNoCache(url: string): string {
  if (!url) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ts=${Date.now()}`;
}
