/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ENGAGEMENT_IMAGE_URL?: string;
  readonly VITE_ENGAGEMENT_QUERY_LIMIT?: string;
  readonly VITE_ENGAGEMENT_QUERY_WINDOW_MINUTES?: string;
}
