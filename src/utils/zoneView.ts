export type ZoneUiState = 'live' | 'offline' | 'upcoming' | 'ended';

export interface LiveZoneLike {
  zoneId: string;
  zoneName: string;
  liveState: number;
  startAt: number | null;
  endAt: number | null;
}

export interface ZoneOptionItem {
  label: string;
  value: string;
  state: ZoneUiState;
  icon: string;
  liveLogo: boolean;
  title: string;
  dateText: string;
  disabled: boolean;
}

export function normalizeZoneId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return String(numeric);
  }

  return raw;
}

function formatDate(value: number | null): string {
  if (!value) {
    return '-';
  }

  const ms = value > 10_000_000_000 ? value : value * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) {
    return '-';
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function resolveZoneUiState(zone: LiveZoneLike, nowEpoch: number): ZoneUiState {
  if (zone.liveState === 1) {
    return 'live';
  }

  if (zone.startAt && nowEpoch < zone.startAt) {
    return 'upcoming';
  }

  if (zone.endAt && nowEpoch > zone.endAt) {
    return 'ended';
  }

  return 'offline';
}

export function toZoneOptionItem(zone: LiveZoneLike, nowEpoch: number): ZoneOptionItem {
  const state = resolveZoneUiState(zone, nowEpoch);

  if (state === 'live') {
    return {
      label: zone.zoneName,
      value: zone.zoneId,
      state,
      icon: 'pi pi-video',
      liveLogo: true,
      title: zone.zoneName,
      dateText: '',
      disabled: false,
    };
  }

  if (state === 'offline') {
    return {
      label: zone.zoneName,
      value: zone.zoneId,
      state,
      icon: 'pi pi-video-off',
      liveLogo: false,
      title: zone.zoneName,
      dateText: '',
      disabled: false,
    };
  }

  if (state === 'upcoming') {
    return {
      label: zone.zoneName,
      value: zone.zoneId,
      state,
      icon: 'pi pi-clock',
      liveLogo: false,
      title: zone.zoneName,
      dateText: formatDate(zone.startAt),
      disabled: true,
    };
  }

  // finished
  return {
    label: zone.zoneName,
    value: zone.zoneId,
    state,
    icon: 'pi pi-check-circle',
    liveLogo: false,
    title: zone.zoneName,
    dateText: formatDate(zone.endAt),
    disabled: true,
  };
}
