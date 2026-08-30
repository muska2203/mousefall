import type {ItemTemplateInput} from '../../../schemas';

/**
 * Шипастый плащ (линия Бойца). Фирменный модификатор mod_spiked_thorns
 * снят при архивации модификаторов (2026-09-01) — вернётся с их переработкой.
 */
export const armorLightSpikedCloak = {
  "id": "armor_light_spiked_cloak",
  "spriteId": "armor_light_spiked_cloak",
  "icon": "/assets/items/armor_light_spiked_cloak.png",
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
  ]
} satisfies ItemTemplateInput;
