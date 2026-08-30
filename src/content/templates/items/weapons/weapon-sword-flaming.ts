import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Обгоревший короткий меч» — огненный меч первой итерации, мост к линии
 * Алхимика (концепт этажа 1, §4.3). Без скиллов.
 * Фирменный модификатор mod_fire_damage_multiplier снят при архивации
 * модификаторов (2026-09-01) — вернётся с их переработкой.
 * Числа черновые — балансный проход roadMap 1.4.
 */
export const weaponSwordFlaming = {
  "id": "weapon_sword_flaming",
  "spriteId": "weapon_sword_flaming",
  "icon": "/assets/items/weapon_sword_flaming.png",
  "fallback": "🔥",
  "type": "weapon",
  "level": 1,
  "subtype": "sword",
  "stackable": false,
  "maxStack": 1,
  "value": 12,
  "weapon": {
    "damage": { "min": 4, "max": 6 },
    "range": 1,
    "damageDistribution": [
      {
        "damageTag": "damage.magical.fire",
        "weight": 1
      }
    ],
    "tags": [
      "attack.melee",
      "target.single",
      "delivery.weapon"
    ]
  },
  "grantedAbilities": []
} satisfies ItemTemplateInput;
