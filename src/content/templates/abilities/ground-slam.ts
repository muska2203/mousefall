import type {AbilityTemplateInput} from '../../schemas';

/**
 * «Удар по земле» первого босса (Кот-Страж): площадной дробящий урон
 * по квадрату 5×5 вокруг кастера по всем существам, кроме него самого (friendly fire),
 * плюс оглушение (dazed) выживших через правило ground_slam_daze.
 * Исполнитель не регистрируется — getSkillExecutor собирает его фабрикой по kind 'groundSlam'.
 * Числа (baseDamage 12) — черновые, до балансного прохода roadMap 1.4.
 */
export const groundSlam = {
  "id": "ground_slam",
  "kind": "groundSlam",
  "spriteId": "ground_slam",
  "cooldown": 4,
  "apCost": 2,
  "aiPreparable": true,
  "damageTag": "damage.physical.blunt",
  "radius": 2,
  "baseDamage": 12,
  "tags": [
    "delivery.ability",
    "attack.melee",
    "target.aoe"
  ],
  "ruleIds": [
    "ground_slam_daze"
  ]
} satisfies AbilityTemplateInput;
