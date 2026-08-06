import type {RelicTemplateInput} from '../../schemas';

export const relicVenomGland = {
  "id": "relic_venom_gland",
  "ruleIds": [
    "relic_venom_gland_poison_on_hit",
    "relic_venom_gland_ramp_up"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_venom_gland.png",
  "fallback": "🍄",
  "rarity": "common"
} satisfies RelicTemplateInput;
