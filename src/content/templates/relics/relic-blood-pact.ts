import type {RelicTemplateInput} from '../../schemas';

export const relicBloodPact = {
  "id": "relic_blood_pact",
  "ruleIds": [
    "relic_blood_pact_power",
    "relic_blood_pact_price"
  ],
  "statModifiers": [],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_blood_pact.png",
  "fallback": "📜",
  "rarity": "common"
} satisfies RelicTemplateInput;
