import type {ItemTemplateInput} from '../../../schemas';

// Флакон крови: разбивается кровавой лужей (blood_puddle) радиуса 1 — все,
// кто стоит в зоне или зайдёт в неё, получают кровотечение на 2 хода.
// Дальность броска 2 — базовая для метаемых расходников (как flour_pouch).
export const bloodFlask = {
  "id": "blood_flask",
  "icon": "/assets/items/blood_flask.png",
  "fallback": "🩸",
  "type": "consumable",
  "stackable": true,
  "maxStack": 5,
  "value": 15,
  "consumable": {
    "effect": "spawn_tile_effect",
    "tileEffectType": "blood_puddle",
    "radius": 1,
    "range": 2
  },
  "apCost": 1
} satisfies ItemTemplateInput;
