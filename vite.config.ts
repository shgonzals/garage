/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // <jeep-sqlite> es un web component (SQLite en navegador)
          isCustomElement: (tag) => tag === 'jeep-sqlite',
        },
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  optimizeDeps: {
    exclude: ['jeep-sqlite'],
  },
  server: { port: 5173 },
  build: {
    // Ionic core (~1,1 MB sin comprimir, ~245 kB gzip) va en un único chunk.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
