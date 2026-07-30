import type {TileEffectTemplateInput} from '../../schemas';

export const smoke = {
  "id": "smoke",
  "layer": "aboveGround",
  "duration": 4,
  "renderOrder": 1,
  "blocksLOS": true,
  "ruleIds": [],
  "canHaveStatus": []
} satisfies TileEffectTemplateInput;
