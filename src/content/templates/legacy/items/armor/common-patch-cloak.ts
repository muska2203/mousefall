import type {ItemTemplateInput} from '../../../../schemas';

export const commonPatchCloak = {
  "id": "common_patch_cloak",
  "spriteId": "common_patch_cloak",
  "icon": "/assets/items/common_patch_cloak.png",
  "fallback": "👘",
  "type": "armor",
  "level": 1,
  "subtype": "light",
  "stackable": false,
  "maxStack": 1,
  "value": 8,
  "armor": {
    "baseArmor": 1
  },
  "grantedAbilities": [],
  "abilityPool": [
    {
      "abilityId": "swiftness",
      "weight": 1
    },
    {
      "abilityId": "battle_rage",
      "weight": 1
    }
  ]
} satisfies ItemTemplateInput;
