import type {AbilityTemplateInput} from '../../schemas';

export const swoop = {
  "id": "swoop",
  "spriteId": "swoop",
  "cooldown": 2,
  "apCost": 2,
  "aiPreparable": true,
  "damageTag": "damage.physical.blunt",
  "tags": [
    "delivery.ability",
    "delivery.movement",
    "attack.melee",
    "target.aoe",
    "effect.knockback"
  ]
} satisfies AbilityTemplateInput;
