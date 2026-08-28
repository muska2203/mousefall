import type {ItemTemplateInput} from '../../../schemas';

export const commonSpikedCloak = {
  "id": "common_spiked_cloak",
  "spriteId": "common_spiked_cloak",
  "icon": "/assets/items/common_spiked_cloak.png",
  "fallback": "🧥",
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
  ],
  "fixedModifiers": ["mod_spiked_thorns"]
} satisfies ItemTemplateInput;
