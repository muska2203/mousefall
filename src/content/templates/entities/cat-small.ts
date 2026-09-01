import type {EntityTemplateInput} from '../../schemas';

export const catSmall = {
  "id": "cat_small",
  "maxAp": 2,
  "aiStrategyId": "hunter",
  "aiSightRadius": 4,
  "health": {
    "max": 5
  },
  "baseStats": {
    "str": 0,
    "dex": 0,
    "int": 0,
    "vit": 0
  },
  "attack": {
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
  "lootTable": [
    {
      "templateId": "health_potion",
      "weight": 1
    },
    {
      "templateId": "armor_light_spiked_cloak",
      "weight": 1
    },
    {
      "templateId": "armor_light_patch_cloak",
      "weight": 1
    },
    {
      "templateId": "weapon_sword_splinter_blade",
      "weight": 1
    }
  ],
  "lootDropTable": [
    {
      "count": 0,
      "weight": 5
    },
    {
      "count": 1,
      "weight": 1
    }
  ],
  "placement": {"scale": 0.8}
} satisfies EntityTemplateInput;
