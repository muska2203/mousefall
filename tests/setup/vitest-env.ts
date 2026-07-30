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

/**
 * Fallback-реестр контента для тестов, не инициализирующих его явно.
 *
 * С переходом на контентные террейны проверки проходимости/LOS/спавна читают
 * шаблоны террейнов из реестра (fail-safe: неизвестный id = непроходим).
 * Тесты, которые вообще не трогают реестр (fov, movement, навыки и т.п.),
 * получают здесь минимальный контент с базовыми террейнами floor/wall/sand.
 * Тесты, инициализирующие реестр сами (initRegistry в beforeEach), перекрывают
 * этот fallback — им нужно включать террейны в свой мок-контент.
 */
import {beforeEach} from 'vitest';
import {getRegistry, initRegistry} from '../../src/content/registry';
import {createObjectContent} from '../fixtures/gameState';

beforeEach(() => {
  try {
    getRegistry();
  } catch {
    initRegistry(createObjectContent());
  }
});
