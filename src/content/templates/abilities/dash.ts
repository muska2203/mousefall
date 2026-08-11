import type {AbilityTemplateInput} from '../../schemas';

export const dash = {
  "id": "dash",
  "kind": "dash",
  "spriteId": "dash",
  "cooldown": 4,
  "apCost": 1,
  "damageTag": "damage.physical.blunt",
  "tags": [
    "delivery.ability",
    "delivery.movement",
    "attack.melee",
    "target.aoe",
    "effect.knockback"
  ]
} satisfies AbilityTemplateInput;
