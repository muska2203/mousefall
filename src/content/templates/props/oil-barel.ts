import type {PropTemplateInput} from '../../schemas';

export const oilBarel = {
  "id": "oil_barel",
  "maxHp": 3,
  "armor": 0,
  "blocksMovement": true,
  "blocksLOS": false,
  "propKind": "barrel",
  "tags": [
    "prop.barrel",
    "contains.oil",
    "flammable"
  ],
  "canHaveStatus": [
    "burning"
  ]
} satisfies PropTemplateInput;
