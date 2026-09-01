import type {ItemTemplateInput} from '../../../schemas';

export const armorLightPatchCloak = {
  "id": "armor_light_patch_cloak",
  "spriteId": "armor_light_patch_cloak",
  "icon": "/assets/items/armor_light_patch_cloak.png",
  "fallback": "👘",
  "type": "armor",
  "level": 1,
  "subtype": "light",
  "stackable": false,
  "maxStack": 1,
  "value": 8,
  "armor": {
    "baseArmor": 0
  },
  "grantedAbilities": [],
  "abilityPool": [

  ]
} satisfies ItemTemplateInput;
