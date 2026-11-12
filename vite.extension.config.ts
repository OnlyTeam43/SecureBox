import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'extension',
  base: './',
  build: {
    outDir: '../dist-extension',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'extension/popup.html'),
        panel: path.resolve(__dirname, 'extension/panel.html'),
        background: path.resolve(__dirname, 'extension/src/background.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
