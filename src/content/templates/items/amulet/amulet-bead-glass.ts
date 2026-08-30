import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Тусклая бусина» — амулет первой итерации (подтип bead).
 * Фирменных модификаторов не было — предмет задуман как носитель случайного
 * stat-аффикса (концепт этажа 1, §4.5); ролл вернётся с переработкой
 * модификаторов.
 */
export const amuletBeadGlass = {
  "id": "amulet_bead_glass",
  "spriteId": "amulet_bead_glass",
  "icon": "/assets/items/amulet_bead_glass.png",
  "fallback": "🧿",
  "type": "amulet",
  "level": 1,
  "subtype": "bead",
  "stackable": false,
  "maxStack": 1,
  "value": 5
} satisfies ItemTemplateInput;
