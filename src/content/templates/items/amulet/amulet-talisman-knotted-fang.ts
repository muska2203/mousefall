import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Кривой клык» — амулет первой итерации (подтип talisman).
 * Фирменный модификатор mod_restore_ap_on_hit снят при архивации
 * модификаторов (2026-09-01) — вернётся с их переработкой.
 */
export const amuletTalismanKnottedFang = {
  "id": "amulet_talisman_knotted_fang",
  "spriteId": "amulet_talisman_knotted_fang",
  "icon": "/assets/items/amulet_talisman_knotted_fang.png",
  "fallback": "🦷",
  "type": "amulet",
  "level": 1,
  "subtype": "talisman",
  "stackable": false,
  "maxStack": 1,
  "value": 5
} satisfies ItemTemplateInput;
