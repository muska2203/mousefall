import type {ItemTemplateInput} from '../../../../schemas';

export const commonEnergizedBead = {
  "id": "common_energized_bead",
  "spriteId": "common_energized_bead",
  "icon": "/assets/items/common_energized_bead.png",
  "fallback": "⚡",
  "type": "amulet",
  "level": 1,
  "subtype": "bead",
  "stackable": false,
  "maxStack": 1,
  "value": 5,
  "fixedModifiers": ["mod_restore_ap_on_hit"]
} satisfies ItemTemplateInput;
