import type {ItemTemplateInput} from '../../../schemas';

export const waterBall = {
  "id": "water_ball",
  "spriteId": "water_ball",
  "icon": "/assets/items/water_ball.png",
  "fallback": "💧",
  "type": "consumable",
  "stackable": true,
  "maxStack": 5,
  "value": 15,
  "consumable": {
    "effect": "spawn_tile_effect",
    "tileEffectType": "water",
    "radius": 1,
    "range": 5
  },
  "apCost": 1
} satisfies ItemTemplateInput;
