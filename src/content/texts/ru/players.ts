import type {ContentText} from '../types';

export const players: Record<string, ContentText> = {
  'elven-ranger': {
    name: 'Тонкоух',
    description: 'Лучник из глубин Сырных Лесов.',
  },
  'halfling-mage': {
    name: 'Сырный Мерлин',
    description: 'Хитрый заклинатель, обращающий сыр в ману.',
  },
  necromancer: {
    name: 'Мышь-Косторез',
    description: 'Тёмный некромант, повелитель плесени.',
  },
  'orc-barbarian': {
    name: 'Клыкохвост',
    description: 'Яростный воин с сырными клыками.',
  },
  paladin: {
    name: 'Сир Чеддар',
    description: 'Благородный рыцарь Сырного Ордена.',
  },
  samurai: {
    name: 'Усатый Сэнсэй',
    description: 'Мастер сырного клинка.',
  },
  witcher: {
    name: 'Белый Хвост',
    description: 'Охотник на чудовищ и мечник-алхимик.',
  },
};
