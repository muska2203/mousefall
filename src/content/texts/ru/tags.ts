import type {ContentText} from '../types';

export const tags: Record<string, ContentText> = {
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
  'delivery.ability': {
    name: 'Способность',
    description: 'Эффект или урон от способности',
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
  'effect.oil': {
    name: 'Масло',
    description: 'Создаёт на тайле эффект масла',
  },
  'effect.water': {
    name: 'Вода',
    description: 'Создаёт на тайле эффект воды',
  },
  'buff.reactive': {
    name: 'Реакция',
    description: 'Реактивный бафф',
  },
  'damage.physical.slashing': {
    name: 'Рубящий',
    description: 'Физический рубящий урон',
  },
  'damage.physical.piercing': {
    name: 'Колющий',
    description: 'Физический колющий урон',
  },
  'damage.physical.blunt': {
    name: 'Дробящий',
    description: 'Физический дробящий урон',
  },
  'damage.magical.fire': {
    name: 'Огонь',
    description: 'Магический огненный урон',
  },
  'damage.magical.electric': {
    name: 'Молния',
    description: 'Магический электрический урон',
  },
  'damage.physical': {
    name: 'Физический урон',
    description: 'Урон физического класса',
  },
  'damage.magical': {
    name: 'Магический урон',
    description: 'Урон магического класса',
  },
  'damage': {
    name: 'Урон',
    description: 'Теги классификации урона',
  },
  attack: {
    name: 'Атака',
    description: 'Теги классификации атаки',
  },
  target: {
    name: 'Цель',
    description: 'Теги классификации цели атаки',
  },
  delivery: {
    name: 'Способ применения',
    description: 'Как наносится эффект или урон',
  },
  'delivery.unarmed': {
    name: 'Без оружия',
    description: 'Атака без экипированного оружия',
  },
  effect: {
    name: 'Эффект',
    description: 'Дополнительный эффект атаки или способности',
  },
  buff: {
    name: 'Бафф',
    description: 'Положительный эффект на актора',
  },
  reaction: {
    name: 'Реакция',
    description: 'Реактивный эффект в ответ на событие',
  },
  'reaction.counter': {
    name: 'Контратака',
    description: 'Удар в ответ на атаку',
  },
};
