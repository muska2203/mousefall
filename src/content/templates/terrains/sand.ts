import type {TerrainTemplateInput} from '../../schemas';

export const sand = {
  "id": "sand",
  "walkable": true,
  "moveCost": 2,
  "blocksLOS": false,
  "tags": [
    "ground"
  ],
  "ruleIds": []
} satisfies TerrainTemplateInput;
