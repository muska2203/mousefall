import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Симуляция безголовая — работает в Node, без браузерных API
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/perf/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      // Измерять покрытие для слоя симуляции и презентации, так как фаза 05.5
      // добавляет модули в src/presentation/.
      include: ['src/simulation/**', 'src/utils/**', 'src/presentation/**'],
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
