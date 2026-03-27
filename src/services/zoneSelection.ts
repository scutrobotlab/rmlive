import { normalizeZoneId } from './zoneView';

export interface ZoneOptionLike {
  value: string;
  disabled: boolean;
}

export interface LiveZoneLike {
  zoneId: string;
  qualities: Array<{
    src?: string | null;
  }>;
}

export interface PickBestZoneCandidateParams {
  options: ZoneOptionLike[];
  enabledOptions: ZoneOptionLike[];
  inferredLiveZoneIdSet: Set<string>;
  scheduleZoneIdSet: Set<string>;
  liveZones: LiveZoneLike[];
  preferredZoneId: string | null;
}

export interface ShouldAutoPromoteZoneParams {
  hasManualZoneSelection: boolean;
  currentOptionValue: string;
  liveFromMatchesValue: string | null;
  inferredLiveZoneIdSet: Set<string>;
  liveZones: LiveZoneLike[];
}

function findZoneByOptionValue(liveZones: LiveZoneLike[], optionValue: string) {
  const normalized = normalizeZoneId(optionValue);
  return liveZones.find((zone) => normalizeZoneId(zone.zoneId) === normalized);
}

export function pickBestZoneCandidate(params: PickBestZoneCandidateParams): string | null {
  const { options, enabledOptions, inferredLiveZoneIdSet, scheduleZoneIdSet, liveZones, preferredZoneId } = params;

  if (!options.length) {
    return null;
  }

  const liveFromMatches = enabledOptions.find((item) => inferredLiveZoneIdSet.has(normalizeZoneId(item.value)));

  const withPlayableStream = enabledOptions.find((item) => {
    const zone = findZoneByOptionValue(liveZones, item.value);
    return Boolean(zone?.qualities?.[0]?.src);
  });

  const preferredEnabled = preferredZoneId
    ? enabledOptions.find((item) => normalizeZoneId(item.value) === normalizeZoneId(preferredZoneId))
    : null;

  const withSchedule = enabledOptions.find((item) => scheduleZoneIdSet.has(normalizeZoneId(item.value)));
  const fallbackEnabled = enabledOptions[0] ?? null;

  return (
    liveFromMatches?.value ??
    withPlayableStream?.value ??
    preferredEnabled?.value ??
    withSchedule?.value ??
    fallbackEnabled?.value ??
    options[0]?.value ??
    null
  );
}

export function shouldAutoPromoteZone(params: ShouldAutoPromoteZoneParams): boolean {
  const { hasManualZoneSelection, currentOptionValue, liveFromMatchesValue, inferredLiveZoneIdSet, liveZones } = params;

  if (hasManualZoneSelection) {
    return false;
  }

  const currentNormalized = normalizeZoneId(currentOptionValue);
  const currentIsLive = inferredLiveZoneIdSet.has(currentNormalized);
  const shouldPromoteToLive = Boolean(liveFromMatchesValue && !currentIsLive);

  return shouldPromoteToLive;
}
