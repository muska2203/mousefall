import type {StatusTemplateInput} from '../../schemas';

/**
 * Статус «Ошеломлён» (dazed).
 *
 * Штраф −1 к maxAp при восстановлении AP реализован через statModifiers
 * (применяются при наложении, снимаются при удалении статуса) —
 * restore-ap-исполнитель читает эффективный maxAp (концепт этажа 1, п.13 §3).
 */
export const dazed = {
  "id": "dazed",
  "ruleIds": [],
  "statusCategory": "physical",
  "categoryPriority": 1,
  "mutuallyExclusiveWith": [],
  "blockedBy": [
    "stunned"
  ],
  "statModifiers": [
    { "stat": "maxAp", "value": -1, "op": "add" }
  ]
} satisfies StatusTemplateInput;
