import type {TerrainTemplateInput} from '../../schemas';

export const floor = {
  "id": "floor",
  "walkable": true,
  "moveCost": 1,
  "blocksLOS": false,
  "tags": [
    "ground"
  ],
  "ruleIds": []
} satisfies TerrainTemplateInput;
