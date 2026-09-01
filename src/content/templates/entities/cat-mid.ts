import type {EntityTemplateInput} from '../../schemas';

export const catMid = {
  "id": "cat_mid",
  "maxAp": 2,
  "aiStrategyId": "hunter",
  "aiSightRadius": 5,
  "health": {
    "max": 7
  },
  "baseStats": {
    "str": 0,
    "dex": 0,
    "int": 0,
    "vit": 0
  },
  "attack": {
    "damage": { "min": 1, "max": 3 },
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
  "abilities": [
    "swoop"
  ],
  "lootTable": [
    {
      "templateId": "health_potion",
      "weight": 1
    },
    {
      "templateId": "armor_heavy_tin_plate",
      "weight": 1
    }
  ],
  "lootDropTable": [
    {
      "count": 0,
      "weight": 2
    },
    {
      "count": 1,
      "weight": 1
    }
  ]
} satisfies EntityTemplateInput;
