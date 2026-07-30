import type {AbilityTemplateInput} from '../../schemas';

export const fireball = {
  "id": "fireball",
  "spriteId": "fireball",
  "cooldown": 0,
  "apCost": 1,
  "damageTag": "damage.magical.fire",
  "tags": [
    "delivery.ability",
    "attack.ranged",
    "target.aoe",
    "delivery.projectile",
    "delivery.spell",
    "effect.burn"
  ]
} satisfies AbilityTemplateInput;
