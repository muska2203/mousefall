import type {TrapTemplateInput} from '../../schemas';

// Мышеловка (концепт этажа 1, §4.7): скрытая одноразовая ловушка —
// урон + кровотечение (категория wound) + обездвиживание на 2 хода
// (категория control). Обнаруживается активным «Поиском» (способность search).
// Числа черновые — балансный проход roadMap 1.4.
export const mousetrap = {
  "id": "mousetrap",
  "ruleIds": [
    "mousetrap_deal_damage",
    "mousetrap_apply_bleeding",
    "mousetrap_apply_rooted"
  ],
  "oneShot": true,
  "initiallyHidden": true,
  "tags": []
} satisfies TrapTemplateInput;
