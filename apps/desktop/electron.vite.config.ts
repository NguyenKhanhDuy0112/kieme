import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    // Workspace packages are TypeScript sources: bundle them; their npm deps stay external.
    plugins: [externalizeDepsPlugin({ exclude: ['@kiemi/shared', '@kiemi/db', '@kiemi/schema'] })],
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
