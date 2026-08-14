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
  "equipment": {
    "weapon": "common_splinter_blade",
    "armor": "cat_guardian_plate"
  },
  "abilities": [
    "guardian_swoop",
    "ground_slam",
    "bulwark"
  ],
  "lootTable": [
    {
      "templateId": "health_potion",
      "weight": 5
    },
    {
      "templateId": "common_splinter_blade",
      "weight": 2
    },
    {
      "templateId": "cat_guardian_maul",
      "weight": 1
    },
    {
      "templateId": "cat_guardian_plate",
      "weight": 1
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
