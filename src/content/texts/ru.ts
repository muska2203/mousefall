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
    cleave: {
      name: 'Рассечение',
      description: 'Удар оружием по дуге рядом с героем. Поражает выбранную клетку и две соседние.',
    },
    dash: {
      name: 'Рывок',
      description: 'Рывок на 2 клетки в выбранном направлении. При столкновении с врагом наносит дробящий урон (зависит от STR) и отталкивает его.',
    },
    fireball: {
      name: 'Огненный шар',
      description: 'Бросок огненного шара в видимую точку на расстоянии до 5 клеток. Взрыв радиусом 1 клетка наносит огненный урон и поджигает цели на 3 хода.',
    },
    magic_slap: {
      name: 'Магический шлёпок',
      description: 'До трёх ударов молнией по выбранным видимым целям в радиусе 5 клеток. Урон электрический, зависит от INT.',
    },
    counterattack: {
      name: 'Контратака',
      description: 'На 2 хода получает 50% шанс ответить ударом на [точный](tag:target.single) урон в [ближнем бою](tag:attack.melee).',
    },
    sudden_strike: {
      name: 'Внезапный удар',
      description: 'Быстрая атака оружием по соседнему врагу. Если цель готовила способность, подготовка сбивается и на неё накладывается немота на 2 хода.',
    },
    swoop: {
      name: 'Налёт',
      description: 'Прыжок в свободную клетку в радиусе 2. Удар по земле наносит всем вокруг дробящий урон, и отталкивает их.',
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
  tags: {
    'attack.melee': {
      name: 'Ближний бой',
      description: 'Атака в соседней клетке',
    },
    'attack.ranged': {
      name: 'Дальний бой',
      description: 'Атака на расстоянии',
    },
    'target.single': {
      name: 'Точный',
      description: 'Поражает конкретную цель',
    },
    'target.aoe': {
      name: 'По области',
      description: 'Поражает несколько целей в радиусе',
    },
    'target.multi': {
      name: 'Несколько целей',
      description: 'Поражает несколько выбранных целей',
    },
    'target.self': {
      name: 'На себя',
      description: 'Действие на самого себя',
    },
    'delivery.weapon': {
      name: 'Оружие',
      description: 'Удар оружием',
    },
    'delivery.spell': {
      name: 'Заклинание',
      description: 'Магический эффект',
    },
    'delivery.projectile': {
      name: 'Снаряд',
      description: 'Летящий снаряд',
    },
    'delivery.movement': {
      name: 'Движение',
      description: 'Включает перемещение',
    },
    'effect.knockback': {
      name: 'Отталкивание',
      description: 'Цель может быть отброшена',
    },
    'effect.burn': {
      name: 'Поджог',
      description: 'Накладывает горение',
    },
    'buff.reactive': {
      name: 'Реакция',
      description: 'Реактивный бафф',
    },
  },
};
