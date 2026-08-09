import type {ItemTemplateInput} from '../../../schemas';

export const catClawSmall = {
  "id": "cat_claw_small",
  "fallback": "🐾",
  "type": "weapon",
  "level": 1,
  "subtype": "dagger",
  "stackable": false,
  "maxStack": 1,
  "value": 2,
  "weapon": {
    "damage": { "min": 1, "max": 2 },
    "range": 1,
    "damageDistribution": [
      {
        "damageTag": "damage.physical.piercing",
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
