import type {ItemTemplateInput} from '../../../schemas';

/**
 * Праща — основное оружие линии Алхимика первого этажа (концепт §4.3).
 * Не «лук», а инструмент дистанции и доставки алхимии:
 * дальняя базовая атака (range 5, min-range 2 — в упор не бьёт, bump деградирует
 * в безоружный удар), фирменная способность «Бросок камня» и фирменный
 * модификатор +5 к дальности броска расходников. Второй активный скилл
 * (roadMap 1.1) — «Рывок» через abilityPool. Числа черновые, до балансного прохода.
 */
export const commonSling = {
  "id": "common_sling",
  "spriteId": "common_sling",
  "icon": "/assets/items/common_sling.png",
  "fallback": "🎯",
  "type": "weapon",
  "level": 1,
  "subtype": "sling",
  "stackable": false,
  "maxStack": 1,
  "value": 10,
  "abilityPool": [
    {
      "abilityId": "dash",
      "weight": 1
    }
  ],
  "grantedAbilities": [
    "stone_throw"
  ],
  "fixedModifiers": [
    "mod_sling_throw_range"
  ],
  "weapon": {
    "damage": { "min": 2, "max": 3 },
    "range": 5,
    "minRange": 2,
    "damageDistribution": [
      {
        "damageTag": "damage.physical.blunt",
        "weight": 1
      }
    ],
    "tags": [
      "attack.ranged",
      "target.single",
      "delivery.weapon"
    ]
  }
} satisfies ItemTemplateInput;
