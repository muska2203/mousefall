import type {AbilityTemplateInput} from '../../schemas';

/**
 * «Глухая оборона» первого босса (Кот-Страж): self-buff статусом bulwark на 1 ход.
 * Исполнитель не регистрируется — getSkillExecutor собирает его фабрикой по kind 'selfBuff'.
 * Кастуется в конце хода босса: статус действует весь ход игрока и снимается
 * тиком в начале следующего хода босса.
 */
export const bulwark = {
  id: 'bulwark',
  kind: 'selfBuff',
  spriteId: 'bulwark',
  cooldown: 4,
  apCost: 1,
  statusType: 'bulwark',
  duration: 1,
  tags: [
    'delivery.ability',
    'target.self',
    'buff',
  ],
} satisfies AbilityTemplateInput;
