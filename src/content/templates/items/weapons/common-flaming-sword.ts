import type {ItemTemplateInput} from '../../../schemas';

export const commonFlamingSword = {
  "id": "common_flaming_sword",
  "spriteId": "common_flaming_sword",
  "icon": "/assets/items/common_flaming_sword.png",
  "fallback": "🔥",
  "type": "weapon",
  "level": 1,
  "subtype": "sword",
  "stackable": false,
  "maxStack": 1,
  "value": 12,
  "weapon": {
    "damage": { "min": 4, "max": 6 },
    "range": 1,
    "damageDistribution": [
      {
        "damageTag": "damage.magical.fire",
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
  "fixedModifiers": ["mod_fire_damage_multiplier"]
} satisfies ItemTemplateInput;
