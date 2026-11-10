import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'workers/url-reader/dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: 'workers/url-reader/index.ts',
      formats: ['es'],
      fileName: () => 'worker.js',
    },
    rollupOptions: {
      output: { entryFileNames: 'worker.js' },
    },
  },
});
