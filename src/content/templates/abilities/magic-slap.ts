import type {AbilityTemplateInput} from '../../schemas';

export const magicSlap = {
  "id": "magic_slap",
  "kind": "magicSlap",
  "spriteId": "magic_slap",
  "cooldown": 2,
  "apCost": 1,
  "aiPreparable": true,
  "damageTag": "damage.magical.electric",
  "range": 5,
  "targetCount": 3,
  "baseDamage": 12,
  "tags": [
    "delivery.ability",
    "attack.ranged",
    "target.single",
    "delivery.spell"
  ]
} satisfies AbilityTemplateInput;
