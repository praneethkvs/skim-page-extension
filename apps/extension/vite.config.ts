import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  resolve: {
    alias: {
      '@skim-page/core': new URL('../../packages/core/src', import.meta.url).pathname,
    },
  },
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: new URL('./src/background.ts', import.meta.url).pathname,
        contentScript: new URL('./src/contentScript.ts', import.meta.url).pathname,
        options: new URL('./options.html', import.meta.url).pathname,
        popup: new URL('./popup.html', import.meta.url).pathname,
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
