import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import { mockDevServerPlugin } from 'vite-plugin-mock-dev-server';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isAnalyze = mode === 'analyze';
  const isBuildIFrame = process.env.VITE_BUILD_IFRAME === 'true' || mode === 'iframe';
  const useRmLiveJsonMock = process.env.VITE_RM_MOCK === '1';

  if (isBuildIFrame) {
    // Build iframe-inject.js as a standalone IIFE
    return {
      plugins: [],
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
      build: {
        lib: {
          entry: path.resolve(__dirname, './src/iframe-inject.ts'),
          name: 'RmLiveInjector',
          formats: ['iife'],
        },
        outDir: 'dist',
        // Keep existing app assets in dist when running iframe build after main build.
        emptyOutDir: false,
        rollupOptions: {
          output: {
            entryFileNames: 'iframe-inject.js',
          },
        },
        minify: 'terser',
      },
    };
  }

  // Main application build configuration
  return {
    base: process.env.VITE_BASE ?? '/',
    plugins: [
      vue(),
      ...mockDevServerPlugin({
        enabled: useRmLiveJsonMock,
        prefix: ['/live_json'],
      }),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        manifest: {
          name: 'RMLive - Better 直播间',
          short_name: 'RMLive',
          description: '更清晰的赛事视图，更顺滑的直播体验。',
          start_url: './',
          display: 'standalone',
          background_color: '#020617',
          theme_color: '#0f172a',
          icons: [
            {
              src: 'rmlive-logo.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}'],
        },
        devOptions: {
          enabled: true,
        },
      }),
      isAnalyze
        ? visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            brotliSize: true,
            open: false,
          })
        : null,
    ].filter(Boolean),
    server: {
      proxy: {
        ...(useRmLiveJsonMock
          ? {}
          : {
              '/live_json': {
                target: 'https://rm-static.djicdn.com/',
                changeOrigin: true,
                rewrite: (path) => {
                  return path;
                },
              },
            }),
        '/rm-static': {
          target: 'https://rm-static.djicdn.com/',
          changeOrigin: true,
          rewrite: (path) => {
            return path.replace(/^\/rm-static\//, '');
          },
        },
      },
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (id.includes('hls.js')) {
              return 'player-hls';
            }

            if (id.includes('artplayer') || id.includes('artplayer-plugin-danmuku')) {
              return 'player-art';
            }

            if (
              id.includes('primevue/datatable') ||
              id.includes('primevue/column') ||
              id.includes('primevue/paginator')
            ) {
              return 'ui-table';
            }

            if (id.includes('primevue/')) {
              const match = id.match(/primevue\/([^/]+)/);
              if (match?.[1]) {
                const component = match[1];

                if (
                  [
                    'dialog',
                    'popover',
                    'tooltip',
                    'message',
                    'toast',
                    'toastservice',
                    'confirmpopup',
                    'confirmdialog',
                  ].includes(component)
                ) {
                  return 'ui-overlay';
                }

                if (
                  [
                    'select',
                    'multiselect',
                    'selectbutton',
                    'listbox',
                    'checkbox',
                    'radiobutton',
                    'inputtext',
                    'inputnumber',
                    'togglebutton',
                    'toggleswitch',
                    'iconfield',
                    'inputicon',
                  ].includes(component)
                ) {
                  return 'ui-form';
                }

                if (
                  [
                    'card',
                    'panel',
                    'toolbar',
                    'tabs',
                    'tab',
                    'tablist',
                    'tabpanels',
                    'tabpanel',
                    'fieldset',
                    'divider',
                    'splitter',
                    'splitterpanel',
                    'skeleton',
                    'scrolltop',
                  ].includes(component)
                ) {
                  return 'ui-layout';
                }

                if (['button', 'tag', 'badge', 'avatar', 'chip', 'progressspinner'].includes(component)) {
                  return 'ui-display';
                }

                return 'ui-core';
              }
              return 'ui-components';
            }

            if (id.includes('@primeuix')) {
              return 'ui-theme';
            }

            if (id.includes('primeicons')) {
              return 'ui-icons';
            }

            if (id.includes('pinia') || id.includes('/vue/')) {
              return 'core-vendor';
            }

            return 'vendor';
          },
        },
      },
    },
  };
});
