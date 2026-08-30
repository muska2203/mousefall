import type {ItemTemplateInput} from '../../../schemas';

/**
 * «Тусклый угольный амулет» — амулет первой итерации (подтип charm).
 * Фирменный модификатор mod_amulet_fire_damage_multiplier снят при архивации
 * модификаторов (2026-09-01) — вернётся с их переработкой.
 */
export const amuletCharmEmber = {
  "id": "amulet_charm_ember",
  "spriteId": "amulet_charm_ember",
  "icon": "/assets/items/amulet_charm_ember.png",
  "fallback": "🔥",
  "type": "amulet",
  "level": 1,
  "subtype": "charm",
  "stackable": false,
  "maxStack": 1,
  "value": 6
} satisfies ItemTemplateInput;
