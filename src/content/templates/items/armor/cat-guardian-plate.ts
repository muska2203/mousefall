import type {ItemTemplateInput} from '../../../schemas';

export const catGuardianPlate = {
  "id": "cat_guardian_plate",
  "spriteId": "cat_guardian_plate",
  "icon": "/assets/items/cat_guardian_plate.png",
  "fallback": "🛡",
  "type": "armor",
  "level": 3,
  "subtype": "heavy",
  "stackable": false,
  "maxStack": 1,
  "value": 35,
  "armor": {
    "baseArmor": 6
  },
  "grantedAbilities": [],
  "fixedModifiers": ["mod_guardian_vitality"]
} satisfies ItemTemplateInput;
