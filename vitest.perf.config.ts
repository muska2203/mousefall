import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Конфигурация для запуска perf-тестов WP6.5.
 *
 * Используется скриптом `npm run test:perf`.
 * Отличается от основной конфигурации `vitest.config.ts` только набором файлов:
 * perf-тесты исключены из обычного `npm test`, чтобы не замедлять CI
 * и не ломать его при использовании `bench()` / длительных замерах.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/perf/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
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
