import type {ItemTemplateInput} from '../../../schemas';

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
      "abilityId": "counterattack",
      "weight": 1
    },
    {
      "abilityId": "swoop",
      "weight": 1
    },
    {
      "abilityId": "cleave",
      "weight": 1
    }
  ],
  "weapon": {
    "damage": { "min": 2, "max": 4 },
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
  "grantedAbilities": [
    "sudden_strike"
  ],
  "fixedModifiers": []
} satisfies ItemTemplateInput;
