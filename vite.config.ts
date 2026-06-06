import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@simulation': resolve(__dirname, 'src/simulation'),
      '@utils':      resolve(__dirname, 'src/utils'),

      '@ui':         resolve(__dirname, 'src/ui'),
      '@content':    resolve(__dirname, 'src/content'),
      '@presentation': resolve(__dirname, 'src/presentation'),
      '@i18n':         resolve(__dirname, 'src/i18n'),
    },
  },
  publicDir: 'public',
});
