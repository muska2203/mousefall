import type { ContentTexts } from './types';

export const ruContentTexts: ContentTexts = {
  items: {
    cat_claw_small: {
      name: 'Коготок',
      description: 'Острый, но маленький. Как и его хозяин.',
    },
    cat_claw_mid: {
      name: 'Уличный коготь',
      description: 'Зазубренный коготь с остатками асфальта.',
    },
    cat_claw_big: {
      name: 'Босс-коготь',
      description: 'Тяжёлый коготь, способный царапать броню.',
    },
    common_splinter_blade: {
      name: 'Ржавый сырорез',
      description: 'Небольшой тупой клинок, от которого пахнет сыром.',
    },
    common_school_wand: {
      name: 'Треснувшая спица',
      description: 'Почти палочка. Почти волшебная.',
    },
    common_patch_cloak: {
      name: 'Потёртый плащ пыльника',
      description: 'Пахнет пылью и тайнами.',
    },
    common_tin_plate: {
      name: 'Жестяная кираса',
      description: 'Гремит при ходьбе, но лучше чем ничего.',
    },
    common_glass_bead: {
      name: 'Тусклая бусина',
      description: 'Кажется, в ней когда-то был свет.',
    },
    common_knotted_fang: {
      name: 'Кривой клык',
      description: 'Кто-то носил его на шее. Теперь — вы.',
    },
    health_potion: {
      name: 'Зелье здоровья',
      description: 'Небольшой пузырёк с красной жидкостью. Восстанавливает 30 HP.',
    },
  },
  entities: {
    cat_small: {
      name: 'Котёнок-разбойник',
      flavorText: 'Ещё вчера он мяукал под окном. Сегодня — грабит караваны.',
    },
    cat_mid: {
      name: 'Уличный кот',
      flavorText: 'Средний бизнес-кот. Нанимает котят и не платит налоги.',
    },
    cat_big: {
      name: 'Босс-кот',
      flavorText: 'Главный кот района. Его гремучее мурлыканье слышно за три квартала.',
    },
  },
  abilities: {
    dash: {
      name: 'Рывок',
      description: 'Рывок на 2 клетки. Пробивает закрытые двери, отталкивает врагов и может оглушить их.',
    },
    fireball: {
      name: 'Огненный шар',
      description: 'Взрыв огня в радиусе 1 клетки. Поджигает цели.',
    },
    magic_slap: {
      name: 'Магический шлёпок',
      description: 'Три быстрых удара магией по выбранным целям.',
    },
    counterattack: {
      name: 'Контратака',
      description: 'Готовит контратаку на следующий ход. Тратит все AP и даёт по одной контратаке за каждое потраченное AP.',
    },
  },
  players: {
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
  },
  stairs: {
    stairs_down: {
      name: 'Лестница вниз',
      flavorText: 'Ведёт в ещё более противную вонь.',
    },
    stairs_up: {
      name: 'Лестница вверх',
      flavorText: 'Обратно к солнечному свету и неоплаченным счетам.',
    },
  },
  doors: {
    wooden_door: {
      name: 'Деревянная дверь',
      flavorText: 'Хрупкая, но лучше, чем ничего.',
    },
  },
};
