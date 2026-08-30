import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Зазубренный сырорез» — меч линии Бойца (концепт этажа 1, §4.3):
 * пул скиллов — рывок/взмах (мобильность и AoE;
 * swoop убран — прыжки зарезервированы для молотов, решение 2026-08-13).
 * Фирменный модификатор mod_bleeding_on_hit снят при архивации модификаторов
 * (2026-09-01) — вернётся с их переработкой.
 * Числа черновые — балансный проход roadMap 1.4.
 */
export const weaponSwordSplinterBlade = {
  "id": "weapon_sword_splinter_blade",
  "spriteId": "weapon_sword_splinter_blade",
  "icon": "/assets/items/weapon_sword_splinter_blade.png",
  "fallback": "🗡",
  "type": "weapon",
  "level": 1,
  "subtype": "sword",
  "stackable": false,
  "maxStack": 1,
  "value": 10,
  "abilityPool": [
    {
      "abilityId": "dash",
      "weight": 1
    },
    {
      "abilityId": "cleave",
      "weight": 1
    }
  ],
  "weapon": {
    "damage": { "min": 1, "max": 2 },
    "range": 1,
    "damageDistribution": [
      {
        "damageTag": "damage.physical.slashing",
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
