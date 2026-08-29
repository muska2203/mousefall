import type {EntityTemplateInput} from '../../schemas';

export const catBig = {
  "id": "cat_big",
  "maxAp": 3,
  "aiStrategyId": "hunter",
  "aiSightRadius": 6,
  "health": {
    "max": 30
  },
  "baseStats": {
    "str": 4,
    "dex": 3,
    "int": 0,
    "vit": 2
  },
  "attack": {
    "damage": { "min": 3, "max": 5 },
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
  "armor": 2,
  "abilities": [
    "magic_slap"
  ],
  "lootTable": [
    {
      "templateId": "health_potion",
      "weight": 5
    }
  ],
  "lootDropTable": [
    {
      "count": 0,
      "weight": 1
    },
    {
      "count": 1,
      "weight": 1
    },
    {
      "count": 2,
      "weight": 2
    }
  ],
  "placement": {"scale": 0.9}
} satisfies EntityTemplateInput;
