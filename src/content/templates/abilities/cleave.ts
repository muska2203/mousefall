import type {AbilityTemplateInput} from '../../schemas';

export const cleave = {
  "id": "cleave",
  "kind": "cleave",
  "spriteId": "cleave",
  "cooldown": 2,
  "apCost": 1,
  "requiredWeaponTags": [
    "attack.melee"
  ],
  "tags": [
    "delivery.ability",
    "attack.melee",
    "target.aoe",
    "delivery.weapon"
  ]
} satisfies AbilityTemplateInput;
