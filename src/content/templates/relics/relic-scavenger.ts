import type {RelicTemplateInput} from '../../schemas';

export const relicScavenger = {
  "id": "relic_scavenger",
  "ruleIds": [
    "relic_scavenger_heal_on_pickup"
  ],
  "statModifiers": [
    {
      "stat": "maxHp",
      "value": -5,
      "op": "add"
    }
  ],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_scavenger.png",
  "fallback": "🧺",
  "rarity": "common"
} satisfies RelicTemplateInput;
