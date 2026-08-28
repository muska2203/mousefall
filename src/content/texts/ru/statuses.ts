import type {ContentText} from '../types';

export const statuses: Record<string, ContentText> = {
  bleeding: {
    name: 'Кровотечение',
    description: 'Наносит физический урон каждый ход.',
  },
  bulwark: {
    name: 'Глухая оборона',
    description: 'Неуязвим к урону и толчкам, но не может действовать. Статусы накладываются как обычно.',
  },
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
  wet: {
    name: 'Мокрый',
    description: 'Тушит горение и смывает масло.',
  },
  oiled: {
    name: 'В масле',
    description: 'Уязвим к огню.',
  },
  rooted: {
    name: 'Обездвижен',
    description: 'Не может перемещаться, но может атаковать и использовать способности.',
  },
  braced: {
    name: 'Стойка',
    description: '+2 к броне, пока статус активен.',
  },
  swift: {
    name: 'Стремительность',
    description: '+1 к максимуму очков действий, пока статус активен.',
  },
  empowered: {
    name: 'Боевой запал',
    description: '+2 к урону, пока статус активен.',
  },
};
