import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue()],
  server: {
    proxy: {
      '/live_json': {
        target: 'https://rm-static.djicdn.com',
        changeOrigin: true,
      },
    },
  },
});
