import type {AbilityTemplateInput} from '../../schemas';

export const swoop = {
  "id": "swoop",
  "kind": "swoop",
  "spriteId": "swoop",
  "cooldown": 2,
  "apCost": 2,
  "aiPreparable": true,
  "damageTag": "damage.physical.blunt",
  "jumpRadius": 2,
  "aoeRadius": 1,
  "baseDamage": 8,
  "tags": [
    "delivery.ability",
    "delivery.movement",
    "attack.melee",
    "target.aoe",
    "effect.knockback"
  ]
} satisfies AbilityTemplateInput;
