import type {AbilityTemplateInput} from '../../schemas';

/**
 * «Боевой запал» — баф урона лёгкой брони (концепт этажа 1, §4.4):
 * self-buff статусом empowered (+2 к урону) на 2 хода.
 * Исполнитель не регистрируется — getSkillExecutor собирает его фабрикой по kind 'selfBuff'.
 * Числа черновые — балансный проход roadMap 1.4.
 */
export const battleRage = {
  id: 'battle_rage',
  kind: 'selfBuff',
  spriteId: 'battle_rage',
  cooldown: 4,
  apCost: 0,
  statusType: 'empowered',
  duration: 2,
  tags: [
    'delivery.ability',
    'target.self',
    'buff',
  ],
} satisfies AbilityTemplateInput;
