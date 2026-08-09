import type {ItemTemplateInput} from '../../../schemas';

export const unarmed = {
  "id": "unarmed",
  "type": "weapon",
  "level": 1,
  "subtype": "unarmed",
  "stackable": false,
  "maxStack": 1,
  "value": 0,
  "weapon": {
    "damage": { "min": 1, "max": 1 },
    "range": 1,
    "damageDistribution": [
      {
        "damageTag": "damage.physical.blunt",
        "weight": 1
      }
    ],
    "tags": [
      "attack.melee",
      "target.single",
      "delivery.weapon",
      "delivery.unarmed"
    ]
  },
  "grantedAbilities": []
} satisfies ItemTemplateInput;
