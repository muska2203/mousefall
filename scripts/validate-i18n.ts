/**
 * Скрипт валидации синхронизации переводов.
 * Рекурсивно сравнивает ruResources и enResources, проверяя отсутствующие ключи.
 */

import { ruResources } from '../src/i18n/locales/ru';
import { enResources } from '../src/i18n/locales/en';

function getMissingKeys(
  base: unknown,
  target: unknown,
  path = '',
): string[] {
  if (typeof base !== 'object' || base === null) return [];
  if (typeof target !== 'object' || target === null) {
    return [path || '<root>'];
  }

  const baseObj = base as Record<string, unknown>;
  const targetObj = target as Record<string, unknown>;
  const missing: string[] = [];

  for (const key of Object.keys(baseObj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (!(key in targetObj)) {
      missing.push(currentPath);
    } else if (typeof baseObj[key] === 'object' && baseObj[key] !== null) {
      missing.push(...getMissingKeys(baseObj[key], targetObj[key], currentPath));
    }
  }

  return missing;
}

const ruMissing = getMissingKeys(enResources, ruResources);
const enMissing = getMissingKeys(ruResources, enResources);

let hasErrors = false;

if (ruMissing.length > 0) {
  console.error('Missing keys in ruResources:');
  ruMissing.forEach((k) => console.error(`  - ${k}`));
  hasErrors = true;
}

if (enMissing.length > 0) {
  console.error('Missing keys in enResources:');
  enMissing.forEach((k) => console.error(`  - ${k}`));
  hasErrors = true;
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log('i18n validation passed: ru and en are synchronized.');
}
