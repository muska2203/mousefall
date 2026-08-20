import type {ContentText} from '../types';

export const modifiers: Record<string, ContentText> = {
  mod_sturdy_armor: {
    name: 'Крепкая',
    description: 'Броня увеличена на {value}.',
  },
  mod_poison_on_hit: {
    name: 'Отравляющая',
    description: 'Удары этим оружием отравляют цель.',
  },
  mod_fragile: {
    name: 'Хрупкая',
    description: 'Максимум здоровья: {value}.',
  },
  mod_dull: {
    name: 'Тупое',
    description: 'Урон: {value}.',
  },
  mod_blunt_daze: {
    name: 'Оглушающая',
    description: 'Атаки тупым уроном оглушают цель на 1 ход.',
  },
  mod_fire_damage_multiplier: {
    name: 'Пылающая',
    description: 'Урон огнём увеличивается на 50%.',
  },
  mod_spiked_thorns: {
    name: 'Шипастая',
    description: 'При получении урона в ближнем бою отражает 2 колющего урона атакующему.',
  },
  mod_amulet_fire_damage_multiplier: {
    name: 'Угольная',
    description: 'Огненные атаки оружием или способностью наносят на 2 урона больше.',
  },
  mod_restore_ap_on_hit: {
    name: 'Бодрящая',
    description: 'Атаки оружием ближнего боя имеют 15% шанс восстановить 1 ОД.',
  },
  mod_guardian_vitality: {
    name: 'Стражникова',
    description: 'Максимум здоровья: +{value}.',
  },
  mod_sling_throw_range: {
    name: 'Дальнобойная',
    description: 'Дальность броска расходников: +{value}.',
  },
};
