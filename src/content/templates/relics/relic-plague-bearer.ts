import type {RelicTemplateInput} from '../../schemas';

export const relicPlagueBearer = {
  "id": "relic_plague_bearer",
  "ruleIds": [
    "relic_plague_bearer_spread",
    "relic_plague_bearer_self_poison"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_plague_bearer.png",
  "fallback": "☠️",
  "rarity": "rare"
} satisfies RelicTemplateInput;
