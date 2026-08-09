import type {ItemTemplateInput} from '../../../schemas';

export const commonGlassBead = {
  "id": "common_glass_bead",
  "spriteId": "common_glass_bead",
  "icon": "/assets/items/common_glass_bead.png",
  "fallback": "🧿",
  "type": "amulet",
  "level": 1,
  "subtype": "bead",
  "stackable": false,
  "maxStack": 1,
  "value": 5
} satisfies ItemTemplateInput;
