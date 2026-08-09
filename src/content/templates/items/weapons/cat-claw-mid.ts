import type {ItemTemplateInput} from '../../../schemas';

export const catClawMid = {
  "id": "cat_claw_mid",
  "fallback": "🐾",
  "type": "weapon",
  "level": 1,
  "subtype": "dagger",
  "stackable": false,
  "maxStack": 1,
  "value": 5,
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
  "grantedAbilities": []
} satisfies ItemTemplateInput;
