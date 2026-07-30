import type {TileEffectTemplateInput} from '../../schemas';

export const oil = {
  "id": "oil",
  "layer": "cover",
  "duration": 5,
  "renderOrder": 2,
  "ruleIds": [
    "oil_applies_oiled",
    "fire_damage_ignites_oil",
    "fire_tile_damage_ignites_oil"
  ],
  "canHaveStatus": [
    "burning"
  ],
  "durationDecreasesWhenHasStatus": [
    "burning"
  ]
} satisfies TileEffectTemplateInput;
