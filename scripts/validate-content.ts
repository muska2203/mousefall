/**
 * Скрипт валидации игрового контента.
 *
 * Загружает все JSON-шаблоны из public/content/, проверяет:
 * - валидность по Zod-схемам (loadAllContent),
 * - ссылки ruleIds в шаблонах (validateContentRuleReferences),
 * - семантику декларативных правил (validateContentRuleSemantics),
 * - наличие переводов для каждого content ID в ru и en.
 *
 * Запуск:
 *   npm run validate:content
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadAllContent } from '../src/content/loader';
import { getRegistry } from '../src/content/registry';
import {
  validateContentRuleReferences,
  validateContentRuleSemantics,
  type ContentRuleValidationError,
} from '../src/simulation/content-rules/validation';
import { ruContentTexts } from '../src/content/texts/ru/index';
import { enContentTexts } from '../src/content/texts/en/index';
import type { ContentTexts } from '../src/content/texts/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = process.env.VALIDATE_CONTENT_DIR
  ? path.resolve(PROJECT_ROOT, process.env.VALIDATE_CONTENT_DIR)
  : path.join(PROJECT_ROOT, 'public/content');

/**
 * ID, для которых переводы не обязательны.
 *
 * На момент WP6.1 таких ID нет: даже технический `unarmed` имеет локализованный
 * текст, потому что он отображается в UI при снятии оружия. Если позже
 * появятся чисто внутренние ID без пользовательского текста — добавлять сюда.
 */
const OPTIONAL_TEXT_IDS = new Set<string>([]);

type TextCategory = keyof ContentTexts;

/**
 * Функция загрузки JSON для Node: пути в манифесте начинаются с `/content/`,
 * заменяем на `public/content/` относительно корня проекта.
 */
async function nodeFetchJson(manifestPath: string): Promise<unknown> {
  const relativePath = manifestPath.replace(/^\/content\//, '');
  const filePath = path.join(CONTENT_DIR, relativePath);
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Проверяет, что для каждого content ID есть перевод в обеих локалях.
 */
function validateTranslations(): { ru: string[]; en: string[] } {
  const registry = getRegistry();
  const categories: { key: TextCategory; map: Map<string, unknown> }[] = [
    { key: 'items', map: registry.items },
    { key: 'entities', map: registry.entities },
    { key: 'abilities', map: registry.abilities },
    { key: 'players', map: registry.players },
    { key: 'statuses', map: registry.statuses },
    { key: 'tileEffects', map: registry.tileEffects },
    { key: 'stairs', map: registry.stairs },
    { key: 'doors', map: registry.doors },
  ];

  const ruMissing: string[] = [];
  const enMissing: string[] = [];

  for (const { key, map } of categories) {
    for (const id of map.keys()) {
      if (OPTIONAL_TEXT_IDS.has(id)) {
        continue;
      }

      const ruDict = ruContentTexts[key];
      const enDict = enContentTexts[key];

      if (!ruDict[id]) {
        ruMissing.push(`${key}.${id}`);
      }
      if (!enDict[id]) {
        enMissing.push(`${key}.${id}`);
      }
    }
  }

  return { ru: ruMissing, en: enMissing };
}

function printRuleErrors(errors: ContentRuleValidationError[]): void {
  for (const error of errors) {
    const location = error.ruleId ? `${error.path} (ruleId: ${error.ruleId})` : error.path;
    console.error(`  [${location}] ${error.field}: ${error.problem}`);
  }
}

async function main(): Promise<number> {
  console.log('[validate-content] Загрузка контента...');

  try {
    await loadAllContent(nodeFetchJson);
  } catch (err) {
    console.error('[validate-content] Ошибка загрузки или схемной валидации контента:');
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  console.log('[validate-content] Контент загружен. Проверка ссылок на правила...');

  let hasErrors = false;

  try {
    validateContentRuleReferences(getRegistry());
    console.log('[validate-content] Ссылки на контентные правила в порядке.');
  } catch (err) {
    hasErrors = true;
    console.error('[validate-content] Ошибка ссылок на правила:');
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  }

  const semanticsErrors = validateContentRuleSemantics(getRegistry());
  if (semanticsErrors.length > 0) {
    hasErrors = true;
    console.error('[validate-content] Семантические ошибки правил:');
    printRuleErrors(semanticsErrors);
  } else {
    console.log('[validate-content] Семантика правил в порядке.');
  }

  const { ru: ruMissing, en: enMissing } = validateTranslations();
  if (ruMissing.length > 0) {
    hasErrors = true;
    console.error('[validate-content] Отсутствуют переводы в ru:');
    ruMissing.forEach((id) => console.error(`  - ${id}`));
  }
  if (enMissing.length > 0) {
    hasErrors = true;
    console.error('[validate-content] Отсутствуют переводы в en:');
    enMissing.forEach((id) => console.error(`  - ${id}`));
  }

  if (ruMissing.length === 0 && enMissing.length === 0) {
    console.log('[validate-content] Переводы для всего контента на месте.');
  }

  if (hasErrors) {
    console.error('[validate-content] Валидация завершена с ошибками.');
    return 1;
  }

  console.log('[validate-content] OK: весь контент валиден.');
  return 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    console.error('[validate-content] Неожиданная ошибка:', err);
    process.exit(1);
  });
