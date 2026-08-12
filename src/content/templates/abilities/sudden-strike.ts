import type {AbilityTemplateInput} from '../../schemas';

export const suddenStrike = {
  "id": "sudden_strike",
  "kind": "suddenStrike",
  "spriteId": "sudden_strike",
  "cooldown": 4,
  "apCost": 1,
  "requiredWeaponTags": [
    "attack.melee"
  ],
  "silenceDuration": 2,
  "tags": [
    "delivery.ability",
    "attack.melee",
    "target.single",
    "delivery.weapon"
  ]
} satisfies AbilityTemplateInput;
