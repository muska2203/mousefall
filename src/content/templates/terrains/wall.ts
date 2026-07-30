import type {TerrainTemplateInput} from '../../schemas';

export const wall = {
  "id": "wall",
  "walkable": false,
  "moveCost": 1,
  "blocksLOS": true,
  "tags": [],
  "ruleIds": []
} satisfies TerrainTemplateInput;
