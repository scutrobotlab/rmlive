import type { CurrentAndNextMatches, Schedule } from '../types/api';
import { normalizeZoneId } from './zoneView';

export function extractInferredLiveZoneIdSet(payload: CurrentAndNextMatches | null): Set<string> {
  if (!payload) {
    return new Set<string>();
  }

  const buckets = Array.isArray(payload)
    ? payload
    : (((payload as Record<string, unknown>).data ??
        (payload as Record<string, unknown>).list ??
        (payload as Record<string, unknown>).records ??
        []) as unknown[]);

  const liveStatuses = new Set(['STARTED', 'RUNNING', 'IN_PROGRESS', 'ONGOING', 'PLAYING']);
  const ids = new Set<string>();

  for (const rawItem of buckets) {
    if (!rawItem || typeof rawItem !== 'object') {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const currentMatch = item.currentMatch as Record<string, unknown> | undefined;
    const status = String(currentMatch?.status ?? '')
      .trim()
      .toUpperCase();

    if (!liveStatuses.has(status)) {
      continue;
    }

    const zone =
      (currentMatch?.zone as Record<string, unknown> | undefined) ??
      (item.zone as Record<string, unknown> | undefined) ??
      undefined;
    const id = normalizeZoneId(zone?.id ?? zone?.zoneId ?? item.zoneId);
    if (id) {
      ids.add(id);
    }
  }

  return ids;
}

export function extractScheduleZoneIdSet(payload: Schedule | null): Set<string> {
  if (!payload || typeof payload !== 'object') {
    return new Set<string>();
  }

  const root = payload as Record<string, unknown>;
  const fromGraph = (
    ((root.data as Record<string, unknown> | undefined)?.event as Record<string, unknown> | undefined)?.zones as
      | Record<string, unknown>
      | undefined
  )?.nodes;
  const fromCurrentEvent = ((
    (root.current_event as Record<string, unknown> | undefined)?.zones as Record<string, unknown> | undefined
  )?.nodes ??
    ((root.currentEvent as Record<string, unknown> | undefined)?.zones as Record<string, unknown> | undefined)
      ?.nodes) as unknown;

  const zones = Array.isArray(fromGraph)
    ? (fromGraph as Record<string, unknown>[])
    : Array.isArray(fromCurrentEvent)
      ? (fromCurrentEvent as Record<string, unknown>[])
      : [];

  const ids = new Set<string>();
  zones.forEach((item) => {
    const id = normalizeZoneId((item as Record<string, unknown>).id);
    if (id) {
      ids.add(id);
    }
  });

  return ids;
}
