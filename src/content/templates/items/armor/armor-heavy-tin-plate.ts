import type {ItemTemplateInput} from '../../../schemas';

/**
 * Жестяная кираса (линия Бойца): фирменная способность brace_stance.
 * Фирменный модификатор mod_spiked_thorns снят при архивации модификаторов
 * (2026-09-01) — вернётся с их переработкой.
 */
export const armorHeavyTinPlate = {
  "id": "armor_heavy_tin_plate",
  "spriteId": "armor_heavy_tin_plate",
  "icon": "/assets/items/armor_heavy_tin_plate.png",
  "fallback": "🥋",
  "type": "armor",
  "level": 1,
  "subtype": "heavy",
  "stackable": false,
  "maxStack": 1,
  "value": 10,
  "armor": {
    "baseArmor": 1
  },
  "grantedAbilities": []
} satisfies ItemTemplateInput;
