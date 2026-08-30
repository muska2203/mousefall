import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Беспокойная бусина» — амулет первой итерации (подтип bead).
 * Фирменный модификатор mod_restore_ap_on_hit снят при архивации
 * модификаторов (2026-09-01) — вернётся с их переработкой.
 */
export const amuletBeadEnergized = {
  "id": "amulet_bead_energized",
  "spriteId": "amulet_bead_energized",
  "icon": "/assets/items/amulet_bead_energized.png",
  "fallback": "⚡",
  "type": "amulet",
  "level": 1,
  "subtype": "bead",
  "stackable": false,
  "maxStack": 1,
  "value": 5
} satisfies ItemTemplateInput;
