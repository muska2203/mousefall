import type {ItemTemplateInput} from '../../../../schemas';

export const commonTinPlate = {
  "id": "common_tin_plate",
  "spriteId": "common_tin_plate",
  "icon": "/assets/items/common_tin_plate.png",
  "fallback": "🥋",
  "type": "armor",
  "level": 1,
  "subtype": "heavy",
  "stackable": false,
  "maxStack": 1,
  "value": 10,
  "armor": {
    "baseArmor": 2
  },
  "grantedAbilities": ["brace_stance"],
  "fixedModifiers": ["mod_spiked_thorns"]
} satisfies ItemTemplateInput;
