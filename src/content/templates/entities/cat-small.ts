import type {EntityTemplateInput} from '../../schemas';

export const catSmall = {
  "id": "cat_small",
  "maxAp": 2,
  "aiStrategyId": "hunter",
  "aiSightRadius": 4,
  "health": {
    "max": 15
  },
  "baseStats": {
    "str": 1,
    "dex": 3,
    "int": 0,
    "vit": 0
  },
  "equipment": {
    "weapon": "common_splinter_blade"
  },
  "lootTable": [
    {
      "templateId": "health_potion",
      "weight": 3
    },
    {
      "templateId": "common_splinter_blade",
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
  "renderScale": 0.8
} satisfies EntityTemplateInput;
