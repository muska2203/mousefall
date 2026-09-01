/**
 * Скрипт валидации игрового контента.
 *
 * Собирает контент из TypeScript-шаблонов (src/content/templates/) и проверяет:
 * - валидность по Zod-схемам (buildContent),
 * - ссылки ruleIds в шаблонах (validateContentRuleReferences),
 * - семантику декларативных правил (validateContentRuleSemantics),
 * - перекрёстные ссылки между шаблонами (validateContentReferences),
 * - ссылки consumable.statuses[*].statusType эффекта applyStatus на реестр статусов,
 * - плейсхолдеры {value} в текстах модификаторов (validateModifierTextPlaceholders),
 * - наличие переводов для каждого content ID в ru и en.
 *
 * Запуск:
 *   npm run validate:content
 */

import { buildContent } from '../src/content/templates';
import { getRegistry, initRegistry } from '../src/content/registry';
import { validateContentReferences, validateModifierTextPlaceholders } from '../src/content/validate-references';
import {
  validateContentRuleReferences,
  validateContentRuleSemantics,
  type ContentRuleValidationError,
} from '../src/simulation/content-rules/validation';
import { ruContentTexts } from '../src/content/texts/ru/index';
import { enContentTexts } from '../src/content/texts/en/index';
import type { ContentTexts } from '../src/content/texts/types';

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
    { key: 'tileEffectStatuses', map: registry.tileEffectStatuses },
    { key: 'stairs', map: registry.stairs },
    { key: 'doors', map: registry.doors },
    { key: 'props', map: registry.props ?? new Map() },
    { key: 'pois', map: registry.pois ?? new Map() },
    { key: 'traps', map: registry.traps ?? new Map() },
    { key: 'terrain', map: registry.terrains ?? new Map() },
    { key: 'relics', map: registry.relics ?? new Map() },
    { key: 'modifiers', map: registry.modifiers ?? new Map() },
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

/**
 * Проверяет, что все statusType в списках statuses расходников с эффектом
 * applyStatus существуют в реестре статусов (по образцу проверки
 * knownStatusIds в validateContentRuleSemantics).
 */
function validateConsumableApplyStatuses(): string[] {
  const registry = getRegistry();
  const knownStatusIds = new Set(registry.statuses.keys());
  const errors: string[] = [];

  for (const [id, item] of registry.items) {
    const consumable = item.consumable;
    if (!consumable || consumable.effect !== 'applyStatus' || !consumable.statuses) continue;

    for (const statusEntry of consumable.statuses) {
      if (!knownStatusIds.has(statusEntry.statusType)) {
        errors.push(`items.${id}: статус "${statusEntry.statusType}" не найден в реестре статусов`);
      }
    }
  }

  return errors;
}

async function main(): Promise<number> {
  console.log('[validate-content] Сборка контента...');

  try {
    initRegistry(buildContent());
  } catch (err) {
    console.error('[validate-content] Ошибка сборки или схемной валидации контента:');
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  console.log('[validate-content] Контент собран. Проверка ссылок на правила...');

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

  const referenceErrors = validateContentReferences(getRegistry());
  if (referenceErrors.length > 0) {
    hasErrors = true;
    console.error('[validate-content] Ошибки ссылок между шаблонами:');
    for (const error of referenceErrors) {
      console.error(`  [${error.path}] ${error.field}: ${error.problem}`);
    }
  } else {
    console.log('[validate-content] Ссылки между шаблонами в порядке.');
  }

  const consumableStatusErrors = validateConsumableApplyStatuses();
  if (consumableStatusErrors.length > 0) {
    hasErrors = true;
    console.error('[validate-content] Ошибки ссылок на статусы в расходниках (applyStatus):');
    for (const error of consumableStatusErrors) {
      console.error(`  ${error}`);
    }
  } else {
    console.log('[validate-content] Ссылки на статусы в расходниках (applyStatus) в порядке.');
  }

  const placeholderErrors = validateModifierTextPlaceholders(getRegistry(), {
    ru: ruContentTexts,
    en: enContentTexts,
  });
  if (placeholderErrors.length > 0) {
    hasErrors = true;
    console.error('[validate-content] Ошибки плейсхолдеров {value} в текстах модификаторов:');
    for (const error of placeholderErrors) {
      console.error(`  [${error.path}] ${error.field}: ${error.problem}`);
    }
  } else {
    console.log('[validate-content] Плейсхолдеры {value} в текстах модификаторов в порядке.');
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
