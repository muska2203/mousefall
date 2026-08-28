import type {StatusTemplateInput} from '../../schemas';

/**
 * Статус «Боевой запал» (empowered) — баф урона лёгкой брони (концепт этажа 1, §4.4).
 *
 * +2 к урону, пока статус активен: модификатор применяется при наложении
 * и снимается при любом удалении статуса (хелпер status-stat-modifiers).
 * Накладывается способностью battle_rage. Числа черновые — балансный проход roadMap 1.4.
 */
export const empowered = {
  "id": "empowered",
  "ruleIds": [],
  "statusCategory": "physical",
  "categoryPriority": 0,
  "mutuallyExclusiveWith": [],
  "blockedBy": [],
  "statModifiers": [
    { "stat": "damage", "value": 2, "op": "add" }
  ]
} satisfies StatusTemplateInput;
