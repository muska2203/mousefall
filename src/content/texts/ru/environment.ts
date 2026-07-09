import type { ContentText } from '../types';

export const stairs: Record<string, ContentText> = {
  stairs_down: {
    name: 'Лестница вниз',
    flavorText: 'Ведёт в ещё более противную вонь.',
  },
  stairs_up: {
    name: 'Лестница вверх',
    flavorText: 'Обратно к солнечному свету и неоплаченным счетам.',
  },
};

export const doors: Record<string, ContentText> = {
  wooden_door: {
    name: 'Деревянная дверь',
    flavorText: 'Хрупкая, но лучше, чем ничего.',
  },
};
