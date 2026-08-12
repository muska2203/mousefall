import type {AbilityTemplateInput} from '../../schemas';

export const fireball = {
  "id": "fireball",
  "kind": "fireball",
  "spriteId": "fireball",
  "cooldown": 0,
  "apCost": 1,
  "damageTag": "damage.magical.fire",
  "range": 5,
  "aoeRadius": 1,
  "centerDamage": 20,
  "aoeDamage": 10,
  "tags": [
    "delivery.ability",
    "attack.ranged",
    "target.aoe",
    "delivery.projectile",
    "delivery.spell",
    "effect.burn"
  ]
} satisfies AbilityTemplateInput;
