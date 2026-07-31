import { logInfo } from '@/utils/observability';

const BAIDU_HM_SRC = 'https://hm.baidu.com/hm.js?3f1cf97abbd1e1969c66676511facc00';

type TrackCategory = '弹幕' | '互动' | '播放器' | '导航' | '设置' | '订阅' | '通知' | '内容' | '错误';

interface TrackEventPayload {
  category: TrackCategory;
  action: string;
  label?: string;
  value?: number;
}

interface ZoneContext {
  zoneId?: string | null;
}

interface MatchContext {
  matchKey?: string | null;
}

export interface TrackEventMap {
  'danmu.send': ZoneContext;
  'danmu.send_fail': ZoneContext;
  'danmu.connect': ZoneContext;
  'danmu.disconnect': ZoneContext;
  'danmu.receive_batch': ZoneContext & { batchSize: number };
  'danmu.connect_error': ZoneContext;
  'danmu.connect_fail': ZoneContext;
  'engagement.support': MatchContext & { side?: 'red' | 'blue' };
  'engagement.reaction': MatchContext & { reactionId: string };
  'player.ready': Record<string, never>;
  'player.quality_change': { quality?: string };
  'player.perspective_change': { perspective?: string };
  'player.stream_retry': ZoneContext;
  'player.stream_error': ZoneContext;
  'nav.zone_change': ZoneContext;
  'settings.theme': { theme: 'dark' | 'light' };
  'settings.danmu': { enabled: boolean };
  'settings.pk': { enabled: boolean };
  'settings.reaction': { enabled: boolean };
  'settings.notify_policy': { policy: string };
  'schedule.follow': { matchId: string };
  'schedule.unfollow': { matchId: string };
  'notify.permission': { permission: string };
  'content.team_data': { teamName: string };
}

export type TrackEventKey = keyof TrackEventMap;

type EventBuilder<D> = (data: D) => TrackEventPayload;

const EVENT_DEF: { [K in TrackEventKey]: EventBuilder<TrackEventMap[K]> } = {
  'danmu.send': (d) => ({ category: '弹幕', action: '发送', label: d.zoneId ?? undefined }),
  'danmu.send_fail': (d) => ({ category: '弹幕', action: '发送失败', label: d.zoneId ?? undefined }),
  'danmu.connect': (d) => ({ category: '弹幕', action: '连接', label: d.zoneId ?? undefined }),
  'danmu.disconnect': (d) => ({ category: '弹幕', action: '断开', label: d.zoneId ?? undefined }),
  'danmu.receive_batch': (d) => ({
    category: '弹幕',
    action: '接收批量',
    label: d.zoneId ?? undefined,
    value: d.batchSize,
  }),
  'danmu.connect_error': (d) => ({ category: '错误', action: '弹幕连接', label: d.zoneId ?? undefined }),
  'danmu.connect_fail': (d) => ({ category: '错误', action: '弹幕连接失败', label: d.zoneId ?? undefined }),
  'engagement.support': (d) => ({
    category: '互动',
    action: '助威',
    label: d.matchKey ?? undefined,
    value: 1,
  }),
  'engagement.reaction': (d) => ({
    category: '互动',
    action: '表情',
    label: d.matchKey ? `${d.matchKey}:${d.reactionId}` : d.reactionId,
    value: 1,
  }),
  'player.ready': () => ({ category: '播放器', action: '就绪' }),
  'player.quality_change': (d) => ({ category: '播放器', action: '切换清晰度', label: d.quality ?? undefined }),
  'player.perspective_change': (d) => ({ category: '播放器', action: '切换视角', label: d.perspective ?? undefined }),
  'player.stream_retry': (d) => ({ category: '播放器', action: '重试', label: d.zoneId ?? undefined }),
  'player.stream_error': (d) => ({ category: '错误', action: '流错误', label: d.zoneId ?? undefined }),
  'nav.zone_change': (d) => ({ category: '导航', action: '切换站点', label: d.zoneId ?? undefined }),
  'settings.theme': (d) => ({ category: '设置', action: '主题', label: d.theme }),
  'settings.danmu': (d) => ({ category: '设置', action: '弹幕开关', label: d.enabled ? '开' : '关' }),
  'settings.pk': (d) => ({ category: '设置', action: 'PK开关', label: d.enabled ? '开' : '关' }),
  'settings.reaction': (d) => ({ category: '设置', action: '对局评价开关', label: d.enabled ? '开' : '关' }),
  'settings.notify_policy': (d) => ({ category: '设置', action: '通知策略', label: d.policy }),
  'schedule.follow': (d) => ({ category: '订阅', action: '关注比赛', label: d.matchId }),
  'schedule.unfollow': (d) => ({ category: '订阅', action: '取消关注', label: d.matchId }),
  'notify.permission': (d) => ({ category: '通知', action: '权限结果', label: d.permission }),
  'content.team_data': (d) => ({ category: '内容', action: '查看战队数据', label: d.teamName }),
};

function isTrackingEnabled(): boolean {
  const flag = import.meta.env.VITE_TRACKING_ENABLED;
  if (flag === '1') {
    return true;
  }
  if (flag === '0') {
    return false;
  }
  return import.meta.env.PROD;
}

function buildBaiduPush(payload: TrackEventPayload): Array<string | number> | null {
  const category = String(payload.category ?? '').trim();
  const action = String(payload.action ?? '').trim();
  if (!category || !action) {
    return null;
  }

  const push: Array<string | number> = ['_trackEvent', category, action];
  const label = typeof payload.label === 'string' ? payload.label.trim() : '';
  if (label) {
    push.push(label);
  }
  if (typeof payload.value === 'number' && Number.isFinite(payload.value)) {
    push.push(payload.value);
  }
  return push;
}

function pushRaw(push: Array<string | number>): void {
  try {
    window._hmt = window._hmt ?? [];
    window._hmt.push(push);
  } catch {
    // swallow: analytics script or window may be unavailable
  }
}

export function buildTrackEvent<K extends TrackEventKey>(
  key: K,
  data: TrackEventMap[K],
): Array<string | number> | null {
  const builder = EVENT_DEF[key];
  if (!builder) {
    return null;
  }
  return buildBaiduPush(builder(data));
}

export function trackEvent<K extends TrackEventKey>(key: K, data: TrackEventMap[K]): void {
  if (!isTrackingEnabled()) {
    return;
  }
  const push = buildTrackEvent(key, data);
  if (!push) {
    return;
  }
  logInfo('tracking', 'event', { key, data });
  pushRaw(push);
}

export function trackPageView(path?: string): void {
  if (!isTrackingEnabled()) {
    return;
  }
  const resolved =
    path ?? (typeof window === 'undefined' ? undefined : `${window.location.pathname}${window.location.search}`);
  if (!resolved) {
    return;
  }
  logInfo('tracking', 'pageview', { path: resolved });
  pushRaw(['_trackPageview', resolved]);
}

let initialized = false;

export function initTracking(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  if (!isTrackingEnabled()) {
    return;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  try {
    window._hmt = window._hmt ?? [];
    if (!document.querySelector('script[data-rmlive-analytics]')) {
      const script = document.createElement('script');
      script.setAttribute('data-rmlive-analytics', '');
      script.async = true;
      script.src = BAIDU_HM_SRC;
      (document.head ?? document.documentElement).appendChild(script);
    }
    trackPageView();
  } catch {
    // swallow: analytics bootstrap must never break app startup
  }
}
