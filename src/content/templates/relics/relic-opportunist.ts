import type {RelicTemplateInput} from '../../schemas';

export const relicOpportunist = {
  "id": "relic_opportunist",
  "ruleIds": [
    "relic_opportunist_bonus",
    "relic_opportunist_hesitant"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_opportunist.png",
  "fallback": "🗡",
  "rarity": "common"
} satisfies RelicTemplateInput;
