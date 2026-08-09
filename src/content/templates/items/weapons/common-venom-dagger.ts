import type {ItemTemplateInput} from '../../../schemas';

export const commonVenomDagger = {
  "id": "common_venom_dagger",
  "spriteId": "common_venom_dagger",
  "icon": "/assets/items/common_venom_dagger.png",
  "fallback": "🗡",
  "type": "weapon",
  "level": 1,
  "subtype": "dagger",
  "stackable": false,
  "maxStack": 1,
  "value": 10,
  "weapon": {
    "damage": { "min": 2, "max": 4 },
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
  "fixedModifiers": ["mod_poison_on_hit"]
} satisfies ItemTemplateInput;
