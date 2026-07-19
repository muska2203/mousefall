import type {ContentText} from '../types';

export const statuses: Record<string, ContentText> = {
  burning: {
    name: 'Горение',
    description: 'Наносит урон огнём каждый ход.',
  },
  counterattack: {
    name: 'Контратака',
    description: 'Шанс ответить ударом на ближнюю атаку.',
  },
  dazed: {
    name: 'Оглушение',
    description: 'Пропускает следующий ход.',
  },
  frozen: {
    name: 'Заморозка',
    description: 'Не может двигаться и атаковать.',
  },
  poisoned: {
    name: 'Отравление',
    description: 'Наносит урон ядом каждый ход.',
  },
  regenerating: {
    name: 'Регенерация',
    description: 'Восстанавливает здоровье каждый ход.',
  },
  silenced: {
    name: 'Немота',
    description: 'Не может использовать способности.',
  },
  stunned: {
    name: 'Ошеломление',
    description: 'Не может совершать действия.',
  },
};
