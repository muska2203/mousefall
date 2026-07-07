import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Симуляция безголовая — работает в Node, без браузерных API
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      // Измерять покрытие только для слоя симуляции
      include: ['src/simulation/**', 'src/utils/**'],
      exclude: ['src/ui/**', 'src/renderer/**', 'src/store/**'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@simulation': resolve(__dirname, 'src/simulation'),
      '@utils':      resolve(__dirname, 'src/utils'),
      '@store':      resolve(__dirname, 'src/store'),
      '@ui':         resolve(__dirname, 'src/ui'),
      '@renderer':   resolve(__dirname, 'src/renderer'),
      '@content':    resolve(__dirname, 'src/content'),
      '@presentation': resolve(__dirname, 'src/presentation'),
      '@i18n':         resolve(__dirname, 'src/i18n'),
    },
  },
});
