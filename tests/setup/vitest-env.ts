/**
 * Полифил browser API для unit-тестов, запускаемых в Node-окружении.
 *
 * PixiJS v8 обращается к navigator.userAgent при импорте модулей;
 * в некоторых CI-окружениях и старых версиях Node глобальный navigator
 * отсутствует, что приводит к ReferenceError на этапе загрузки тестов.
 */

if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      userAgent: 'node',
      language: 'en-US',
      languages: ['en-US'],
      platform: 'node',
    },
  });
}
