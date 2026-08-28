import type {AbilityTemplateInput} from '../../schemas';

/**
 * «Стремительность» — баф передвижения лёгкой брони (концепт этажа 1, §4.4):
 * self-buff статусом swift (+1 к максимуму AP) на 2 хода.
 * Исполнитель не регистрируется — getSkillExecutor собирает его фабрикой по kind 'selfBuff'.
 * Числа черновые — балансный проход roadMap 1.4.
 */
export const swiftness = {
  id: 'swiftness',
  kind: 'selfBuff',
  spriteId: 'swiftness',
  cooldown: 4,
  apCost: 1,
  statusType: 'swift',
  duration: 2,
  tags: [
    'delivery.ability',
    'target.self',
    'buff',
  ],
} satisfies AbilityTemplateInput;
