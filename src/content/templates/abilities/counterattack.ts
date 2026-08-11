import type {AbilityTemplateInput} from '../../schemas';

export const counterattack = {
  "id": "counterattack",
  "kind": "selfBuff",
  "spriteId": "counterattack",
  "cooldown": 4,
  "apCost": 2,
  "statusType": "counterattack",
  "duration": 2,
  "requiredWeaponTags": [
    "attack.melee"
  ],
  "tags": [
    "delivery.ability",
    "attack.melee",
    "target.single",
    "delivery.weapon",
    "reaction.counter"
  ]
} satisfies AbilityTemplateInput;
