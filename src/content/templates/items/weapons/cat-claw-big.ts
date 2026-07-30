import type {ItemTemplateInput} from '../../../schemas';

export const catClawBig = {
  "id": "cat_claw_big",
  "fallback": "🐾",
  "type": "weapon",
  "stackable": false,
  "maxStack": 1,
  "value": 12,
  "weapon": {
    "baseDamage": 4,
    "damageFormulaId": "dagger",
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
  "grantedAbilities": [],
  "equipModifiers": []
} satisfies ItemTemplateInput;
