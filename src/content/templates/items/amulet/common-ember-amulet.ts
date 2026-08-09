import type {ItemTemplateInput} from '../../../schemas';

export const commonEmberAmulet = {
  "id": "common_ember_amulet",
  "spriteId": "common_ember_amulet",
  "icon": "/assets/items/common_ember_amulet.png",
  "fallback": "🔥",
  "type": "amulet",
  "level": 1,
  "subtype": "charm",
  "stackable": false,
  "maxStack": 1,
  "value": 6,
  "fixedModifiers": ["mod_amulet_fire_damage_multiplier"]
} satisfies ItemTemplateInput;
