import type {AbilityTemplateInput} from '../../schemas';

/**
 * «Бросок камня» — фирменная способность пращи (common_sling): плоский дробящий
 * урон 3 по одной цели в прямой видимости и толчок на 1 клетку от кастера.
 * Камни — бесконечный боеприпас. Роль — столкновения (урон/daze при столкновении
 * дают глобальные правила collision_*) и выбивание врагов в масло/мышеловки/муку.
 * Числа черновые, до балансного прохода roadMap 1.4 (концепт этажа 1, §4.3).
 */
export const stoneThrow = {
  "id": "stone_throw",
  "kind": "throw",
  "spriteId": "stone_throw",
  "cooldown": 2,
  "apCost": 1,
  "damageTag": "damage.physical.blunt",
  "range": 5,
  "baseDamage": 3,
  "pushDistance": 1,
  "tags": [
    "delivery.ability",
    "attack.ranged",
    "target.single",
    "effect.knockback"
  ]
} satisfies AbilityTemplateInput;
