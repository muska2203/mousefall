import type {RelicTemplateInput} from '../../schemas';

export const relicAcidBlood = {
  "id": "relic_acid_blood",
  "ruleIds": [
    "relic_acid_blood_poison_attacker"
  ],
  "statModifiers": [
    {
      "stat": "armor",
      "value": -1,
      "op": "add"
    }
  ],
  "stackable": false,
  "grantedAbilities": [],
  "icon": "/assets/relics/relic_acid_blood.png",
  "fallback": "🩸",
  "rarity": "common"
} satisfies RelicTemplateInput;
