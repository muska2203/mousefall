import type {ItemTemplateInput} from '../../../schemas';

export const catGuardianMaul = {
  "id": "cat_guardian_maul",
  "spriteId": "cat_guardian_maul",
  "icon": "/assets/items/cat_guardian_maul.png",
  "fallback": "🔨",
  "type": "weapon",
  "level": 3,
  "subtype": "club",
  "stackable": false,
  "maxStack": 1,
  "value": 40,
  "weapon": {
    "damage": { "min": 6, "max": 10 },
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
  },
  "grantedAbilities": [],
  "fixedModifiers": ["mod_blunt_daze"]
} satisfies ItemTemplateInput;
