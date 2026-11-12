import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'client/index.html'),
        securebox: path.resolve(__dirname, 'client/securebox.html'),
        dropbox: path.resolve(__dirname, 'client/dropbox.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
