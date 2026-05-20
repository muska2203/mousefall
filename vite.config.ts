import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@simulation': resolve(__dirname, 'src/simulation'),
      '@utils':      resolve(__dirname, 'src/utils'),
      '@store':      resolve(__dirname, 'src/store'),
      '@ui':         resolve(__dirname, 'src/ui'),
      '@renderer':   resolve(__dirname, 'src/renderer'),
      '@content':    resolve(__dirname, 'src/simulation/content'),
      '@presentation': resolve(__dirname, 'src/presentation'),
    },
  },
  publicDir: 'public',
});
