import type {ItemTemplateInput} from '../../../schemas';

export const catClawBig = {
  "id": "cat_claw_big",
  "fallback": "🐾",
  "type": "weapon",
  "level": 2,
  "subtype": "dagger",
  "stackable": false,
  "maxStack": 1,
  "value": 12,
  "weapon": {
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
  "grantedAbilities": []
} satisfies ItemTemplateInput;
