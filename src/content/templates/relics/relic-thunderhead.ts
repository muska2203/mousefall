import type {RelicTemplateInput} from '../../schemas';

export const relicThunderhead = {
  "id": "relic_thunderhead",
  "ruleIds": [
    "relic_thunderhead_daze",
    "relic_thunderhead_clumsy"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_thunderhead.png",
  "fallback": "⚡",
  "rarity": "common"
} satisfies RelicTemplateInput;
