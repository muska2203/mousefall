import type {TileEffectTemplateInput} from '../../schemas';

export const water = {
  "id": "water",
  "layer": "cover",
  "duration": 4,
  "renderOrder": 1,
  "ruleIds": [
    "water_applies_wet",
    "water_applies_wet_on_spawn"
  ],
  "canHaveStatus": []
} satisfies TileEffectTemplateInput;
