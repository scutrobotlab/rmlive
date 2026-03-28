/** Same default as `startRmPolling` `scheduleMs` in `rmApi.ts`. */
export const SCHEDULE_JSON_POLL_MS = 45_000;

/** Avoid duplicate SW fetches when `schedule` watch and interval fire close together. */
export const SCHEDULE_NOTIFY_SW_THROTTLE_MS = 4_000;
