import type {ItemTemplateInput} from '../../../../schemas';

export const commonSchoolWand = {
  "id": "common_school_wand",
  "spriteId": "common_school_wand",
  "icon": "/assets/items/common_school_wand.png",
  "fallback": "🪄",
  "type": "weapon",
  "level": 1,
  "subtype": "staff",
  "stackable": false,
  "maxStack": 1,
  "value": 10,
  "abilityPool": [
    {
      "abilityId": "fireball",
      "weight": 1
    },
    {
      "abilityId": "magic_slap",
      "weight": 1
    }
  ],
  "grantedAbilities": [],
  "weapon": {
    "damage": { "min": 2, "max": 3 },
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
      "delivery.weapon"
    ]
  }
} satisfies ItemTemplateInput;
