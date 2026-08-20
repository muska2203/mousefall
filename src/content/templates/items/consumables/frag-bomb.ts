import type {ItemTemplateInput} from '../../../schemas';

export const fragBomb = {
  "id": "frag_bomb",
  "fallback": "💣",
  "type": "consumable",
  "stackable": true,
  "maxStack": 5,
  "value": 20,
  "consumable": {
    "effect": "damage",
    "value": 6,
    "damageTag": "damage.physical.piercing",
    "radius": 1,
    "range": 2
  },
  "apCost": 1
} satisfies ItemTemplateInput;
