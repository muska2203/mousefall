import type {StatusTemplateInput} from '../../schemas';

/**
 * Статус «Стремительность» (swift) — баф передвижения лёгкой брони (концепт этажа 1, §4.4).
 *
 * +1 к максимуму AP, пока статус активен (восстановление AP и снапшот характеристик
 * читают эффективный maxAp). Накладывается способностью swiftness.
 * Числа черновые — балансный проход roadMap 1.4.
 */
export const swift = {
  "id": "swift",
  "ruleIds": [],
  "statusCategory": "physical",
  "categoryPriority": 0,
  "mutuallyExclusiveWith": [],
  "blockedBy": [],
  "statModifiers": [
    { "stat": "maxAp", "value": 1, "op": "add" }
  ]
} satisfies StatusTemplateInput;
