import type {AbilityTemplateInput} from '../../schemas';

/**
 * «Налёт» первого босса (Кот-Страж): босс-вариант swoop с дальностью прыжка 3
 * (у базового swoop — 2), чтобы догонять дальнобойного игрока.
 * Исполнитель не регистрируется — getSkillExecutor собирает его фабрикой по kind 'swoop'.
 * Числа (baseDamage 10) — черновые, до балансного прохода roadMap 1.4.
 */
export const guardianSwoop = {
  "id": "guardian_swoop",
  "kind": "swoop",
  "spriteId": "swoop",
  "cooldown": 2,
  "apCost": 2,
  "aiPreparable": true,
  "damageTag": "damage.physical.blunt",
  "jumpRadius": 3,
  "aoeRadius": 1,
  "baseDamage": 10,
  "tags": [
    "delivery.ability",
    "delivery.movement",
    "attack.melee",
    "target.aoe",
    "effect.knockback"
  ]
} satisfies AbilityTemplateInput;
