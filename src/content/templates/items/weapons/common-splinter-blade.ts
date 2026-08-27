import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Зазубренный сырорез» — меч раздачи кровотечений (линия Бойца,
 * концепт этажа 1, §4.3): фирменный модификатор mod_bleeding_on_hit,
 * пул скиллов — рывок/взмах (мобильность и AoE-раздача bleeding;
 * swoop убран — прыжки зарезервированы для молотов, решение 2026-08-13).
 * Числа черновые — балансный проход roadMap 1.4.
 */
export const commonSplinterBlade = {
  "id": "common_splinter_blade",
  "spriteId": "common_splinter_blade",
  "icon": "/assets/items/common_splinter_blade.png",
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
  "grantedAbilities": [],
  "fixedModifiers": ["mod_bleeding_on_hit"]
} satisfies ItemTemplateInput;
