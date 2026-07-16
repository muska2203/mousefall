/**
 * Декларативные контентные правила.
 *
 * Правила хранятся как статические TypeScript-объекты и регистрируются в реестре
 * content-rules/registry.ts. Шаблоны предметов, способностей и статусов ссылаются
 * на них по полю `ruleIds`.
 */

import type {ContentRule, WorldContentRule} from './types';
import {GLOBAL_WORLD_CONTENT_RULES} from './world-rules/global-rules';
import {counterattackTriggerRule, counterattackDamageRule} from './counterattack-rules';

/**
 * Правила, привязанные к источнику (предмет, способность, талант).
 *
 * На данном этапе здесь находятся только пилотные правила. Тестовые правила
 * живут в tests/fixtures/content-rules.ts и подключаются через
 * setWorldContentRulesOverride / overrideContentRulesForTest при необходимости.
 */
export const CONTENT_RULES: readonly ContentRule[] = [
  counterattackTriggerRule,
  counterattackDamageRule,
  {
    id: 'item_fire_damage_multiplier',
    trigger: {
      event: 'DAMAGE',
      tags: ['damage.magical.fire'],
    },
    effect: {
      type: 'modifyDamage',
      op: 'multiply',
      value: 1.5,
    },
    target: {type: 'eventTarget'},
    priority: 0,
  },
];

/**
 * Глобальные мировые контентные правила.
 *
 * Реэкспорт из выделенного модуля `world-rules/global-rules`.
 * Внутри слоя `world` они имеют подтип `worldLayer: 'global'`.
 */
export const WORLD_CONTENT_RULES: readonly WorldContentRule[] = GLOBAL_WORLD_CONTENT_RULES;

/** Переопределение мировых правил, используемое только в тестах. */
let worldContentRulesOverride: readonly WorldContentRule[] | null = null;

/**
 * Возвращает актуальный набор мировых контентных правил.
 *
 * В production всегда возвращает `WORLD_CONTENT_RULES`. В тестах может
 * вернуть переопределённый набор, установленный через
 * `setWorldContentRulesOverride`.
 */
export function getWorldContentRules(): readonly WorldContentRule[] {
  return worldContentRulesOverride ?? WORLD_CONTENT_RULES;
}

/**
 * Устанавливает переопределение мировых контентных правил.
 *
 * Передача `null` сбрасывает переопределение. Используется исключительно
 * в тестах для подключения тестовых мировых правил без загрязнения
 * production-реестра.
 */
export function setWorldContentRulesOverride(
  rules: readonly WorldContentRule[] | null,
): void {
  worldContentRulesOverride = rules;
}
