import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@kiemi/shared'] })],
  },
  preload: {
    // Sandboxed preload scripts must be CommonJS; package has no "type": "module".
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
