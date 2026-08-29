import type {EntityTemplateInput} from '../../schemas';

export const catGuardian = {
  "id": "cat_guardian",
  "isBoss": true,
  "maxAp": 3,
  "aiStrategyId": "guardian-boss",
  "aiSightRadius": 8,
  "health": {
    // Черновое значение (было 80) — финальный баланс в проходе roadMap 1.4.
    "max": 90
  },
  "baseStats": {
    "str": 6,
    "dex": 2,
    "int": 2,
    "vit": 6
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
  "armor": 6,
  "abilities": [
    "guardian_swoop",
    "ground_slam",
    "bulwark"
  ],
  "lootTable": [
    {
      "templateId": "health_potion",
      "weight": 5
    }
  ],
  "lootDropTable": [
    {
      "count": 2,
      "weight": 1
    },
    {
      "count": 3,
      "weight": 2
    }
  ],
  "placement": {"scale": 1.2}
} satisfies EntityTemplateInput;
