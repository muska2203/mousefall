import type {ItemTemplateInput} from '../../../schemas';

export const catClawSmall = {
  "id": "cat_claw_small",
  "fallback": "🐾",
  "type": "weapon",
  "stackable": false,
  "maxStack": 1,
  "value": 2,
  "weapon": {
    "baseDamage": 1,
    "damageFormulaId": "dagger",
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
  "grantedAbilities": [],
  "equipModifiers": []
} satisfies ItemTemplateInput;
