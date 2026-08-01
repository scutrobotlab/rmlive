export const ENV = {
  get CHATROOM_APP_ID() {
    return import.meta.env.VITE_CHATROOM_APP_ID as string;
  },
  get CHATROOM_APP_KEY() {
    return import.meta.env.VITE_CHATROOM_APP_KEY as string;
  },
  get ENGAGEMENT_CHATROOM_ID() {
    return import.meta.env.VITE_ENGAGEMENT_CHATROOM_ID as string;
  },
  get LIVEJSON_PROXY() {
    return String(import.meta.env.VITE_LIVEJSON_PROXY ?? '').trim();
  },
  get IMG_PROXY() {
    return String(import.meta.env.VITE_IMG_PROXY ?? '').trim();
  },
  get TRACKING_ENABLED() {
    return import.meta.env.VITE_TRACKING_ENABLED;
  },
} as const;
