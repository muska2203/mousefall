import type {AbilityTemplateInput} from '../../schemas';

/**
 * «Стойка» — защитный скилл тяжёлой брони (концепт этажа 1, §4.4):
 * self-buff статусом braced (+2 брони) на 2 хода.
 * Исполнитель не регистрируется — getSkillExecutor собирает его фабрикой по kind 'selfBuff'.
 * Числа черновые — балансный проход roadMap 1.4.
 */
export const braceStance = {
  id: 'brace_stance',
  kind: 'selfBuff',
  spriteId: 'brace_stance',
  cooldown: 4,
  apCost: 1,
  statusType: 'braced',
  duration: 2,
  tags: [
    'delivery.ability',
    'target.self',
    'buff',
  ],
} satisfies AbilityTemplateInput;
