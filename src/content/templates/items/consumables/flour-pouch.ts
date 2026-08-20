import type {ItemTemplateInput} from '../../../schemas';

// Мешочек муки: создаёт облако взвешанной муки (flour_cloud) — блокирует обзор,
// скрывает сущностей внутри и взрывается от огня. Дальность броска 2 —
// базовая для метаемых расходников (решение floor-1-content-concept.md §4.6).
export const flourPouch = {
  "id": "flour_pouch",
  "spriteId": "flour_pouch",
  "icon": "/assets/items/flour_pouch.png",
  "fallback": "🌫️",
  "type": "consumable",
  "stackable": true,
  "maxStack": 5,
  "value": 15,
  "consumable": {
    "effect": "spawn_tile_effect",
    "tileEffectType": "flour_cloud",
    "radius": 1,
    "range": 2
  },
  "apCost": 1
} satisfies ItemTemplateInput;
