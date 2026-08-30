import type {ItemTemplateInput} from '../../../schemas';

/**
 * Праща — основное оружие линии Алхимика первого этажа (концепт §4.3).
 * Не «лук», а инструмент дистанции и доставки алхимии:
 * дальняя базовая атака (range 5, min-range 2 — в упор не бьёт: bump-атака
 * отклоняется с тостом, деградации в безоружный удар нет) и фирменная
 * способность «Бросок камня». Второй активный скилл
 * (roadMap 1.1) — «Рывок» через abilityPool.
 * Фирменный модификатор +5 к дальности броска расходников снят при архивации
 * модификаторов (2026-09-01) — вернётся с их переработкой.
 * Числа черновые, до балансного прохода.
 */
export const weaponSling = {
  "id": "weapon_sling",
  "spriteId": "weapon_sling",
  "icon": "/assets/items/weapon_sling.png",
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
