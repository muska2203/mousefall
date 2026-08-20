import type {ItemTemplateInput} from '../../../schemas';

export const incendiaryBomb = {
  "id": "incendiary_bomb",
  "fallback": "🧨",
  "type": "consumable",
  "stackable": true,
  "maxStack": 5,
  "value": 20,
  "consumable": {
    "effect": "damage",
    "value": 4,
    "damageTag": "damage.magical.fire",
    "radius": 1,
    "range": 2
  },
  "apCost": 1
} satisfies ItemTemplateInput;
