import type {TileEffectStatusTemplateInput} from '../../schemas';

export const burning = {
  "id": "burning",
  "duration": 3,
  "neverExpires": true,
  "ruleIds": [
    "burning_spreads_to_flammable",
    "burning_deals_damage_on_entry",
    "burning_applies_burning",
    "burning_tile_status_applied_deals_damage",
    "burning_tile_status_applied_applies_burning"
  ],
  "statusCategory": "elemental",
  "categoryPriority": 1,
  "mutuallyExclusiveWith": [],
  "blockedBy": [],
  "renderOrder": 10
} satisfies TileEffectStatusTemplateInput;
