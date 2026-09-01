import type {ItemTemplateInput} from '../../../schemas';

/**
 * Шипастый плащ (линия Бойца). Фирменный модификатор mod_spiked_thorns
 * возвращён вместе с модификаторами кровавой ветки билдов
 * (этап 0 плана docs/plans/bleed-builds-implementation.md).
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
    "baseArmor": 0
  },
  "grantedAbilities": [],
  "fixedModifiers": ["mod_spiked_thorns"],
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
