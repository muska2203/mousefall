import type {StatusTemplateInput} from '../../schemas';

/**
 * Статус «Стойка» (braced) — баф тяжёлой брони (концепт этажа 1, §4.4).
 *
 * +2 к броне, пока статус активен: модификатор применяется при наложении
 * и снимается при любом удалении статуса (хелпер status-stat-modifiers).
 * Накладывается способностью brace_stance. Числа черновые — балансный проход roadMap 1.4.
 */
export const braced = {
  "id": "braced",
  "ruleIds": [],
  "statusCategory": "physical",
  "categoryPriority": 0,
  "mutuallyExclusiveWith": [],
  "blockedBy": [],
  "statModifiers": [
    { "stat": "armor", "value": 2, "op": "add" }
  ]
} satisfies StatusTemplateInput;
