export interface ReactionCatalogItem {
  id: string;
  name: string;
  url: string;
}

let cached: ReactionCatalogItem[] | null = null;
let inflight: Promise<ReactionCatalogItem[]> | null = null;

function normalizeEntry(raw: unknown): ReactionCatalogItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  const name = String(o.name ?? o.id ?? '').trim();
  const url = String(o.url ?? '').trim();
  if (!id || !url) {
    return null;
  }
  return { id, name: name || id, url };
}

/**
 * Loads `/reactions/reactions.json` once (cached). Safe for SSR-less SPA.
 */
export async function loadReactionCatalog(): Promise<ReactionCatalogItem[]> {
  if (cached) {
    return cached;
  }
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    try {
      const res = await fetch('/reactions/reactions.json', { cache: 'no-store' });
      if (!res.ok) {
        console.warn('[reactions] Failed to load catalog:', res.status);
        cached = [];
        return cached;
      }
      const data: unknown = await res.json();
      if (!Array.isArray(data)) {
        cached = [];
        return cached;
      }
      const list = data.map(normalizeEntry).filter((x): x is ReactionCatalogItem => x !== null);
      cached = list;
      return list;
    } catch (e) {
      console.warn('[reactions] Catalog fetch error:', e);
      cached = [];
      return cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
