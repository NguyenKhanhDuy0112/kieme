import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          // Workspace packages are TypeScript sources: bundle them.
          '@kiemi/shared',
          '@kiemi/db',
          '@kiemi/schema',
          '@kiemi/engine',
          // ESM-only packages cannot be require()d by the CommonJS main bundle.
          'uuid',
          '@faker-js/faker',
          'date-fns',
        ],
      }),
    ],
  },
  preload: {
    // Sandboxed preload scripts must be CommonJS and cannot require node_modules,
    // so electron-trpc is bundled into the preload output.
    plugins: [externalizeDepsPlugin({ exclude: ['electron-trpc'] })],
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@main': resolve(__dirname, 'src/main'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
