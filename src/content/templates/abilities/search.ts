import type {AbilityTemplateInput} from '../../schemas';

/**
 * «Поиск» — врождённая способность игрока (innateAbilities шаблонов игрока):
 * раскрывает скрытые ловушки в радиусе 3 вокруг персонажа, только в прямой
 * видимости (LOS). AP тратится всегда, даже если ничего не найдено.
 * Радиус и стоимость — балансные ручки прохода roadMap 1.4
 * (концепт этажа 1, п.5 §3; радиус 3 — решение 2026-08-13).
 */
export const search = {
  "id": "search",
  "kind": "search",
  "spriteId": "search",
  "cooldown": 0,
  "apCost": 1,
  "radius": 3,
  "tags": [
    "delivery.ability"
  ]
} satisfies AbilityTemplateInput;
