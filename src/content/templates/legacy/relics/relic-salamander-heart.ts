import type {RelicTemplateInput} from '../../../schemas';

export const relicSalamanderHeart = {
  "id": "relic_salamander_heart",
  "ruleIds": [
    "relic_salamander_heart_fire_infusion",
    "relic_salamander_heart_fire_vulnerability"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_salamander_heart.png",
  "fallback": "🔥",
  "rarity": "common"
} satisfies RelicTemplateInput;
