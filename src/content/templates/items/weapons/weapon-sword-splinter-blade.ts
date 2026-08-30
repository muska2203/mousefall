import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Зазубренный сырорез» — меч линии Бойца (концепт этажа 1, §4.3):
 * пул скиллов — рывок/взмах (мобильность и AoE;
 * swoop убран — прыжки зарезервированы для молотов, решение 2026-08-13).
 * Фирменный модификатор mod_blood_on_hit возвращён вместе с модификаторами
 * кровавой ветки билдов (этап 0 плана docs/plans/bleed-builds-implementation.md).
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
    "damage": { "min": 4, "max": 6 },
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
  "grantedAbilities": [],
  "fixedModifiers": ["mod_blood_on_hit"]
} satisfies ItemTemplateInput;
