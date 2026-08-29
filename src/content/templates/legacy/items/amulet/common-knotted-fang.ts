import type {ItemTemplateInput} from '../../../../schemas';

export const commonKnottedFang = {
  "id": "common_knotted_fang",
  "spriteId": "common_knotted_fang",
  "icon": "/assets/items/common_knotted_fang.png",
  "fallback": "🦷",
  "type": "amulet",
  "level": 1,
  "subtype": "talisman",
  "stackable": false,
  "maxStack": 1,
  "value": 5,
  "fixedModifiers": ["mod_restore_ap_on_hit"]
} satisfies ItemTemplateInput;
