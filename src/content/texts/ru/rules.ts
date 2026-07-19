import type {ContentText} from '../types';

export const rules: Record<string, ContentText> = {
  item_fire_damage_multiplier: {
    name: 'Пылающий удар',
    description: 'Урон огнём увеличивается на 50%.',
  },
  weapon_poison_on_hit: {
    name: 'Ядовитое лезвие',
    description: 'Атаки колющим или рубящим уроном имеют 40% шанс наложить яд на 3 хода.',
  },
  weapon_blunt_daze: {
    name: 'Оглушающий удар',
    description: 'Атаки тупым уроном имеют 25% шанс оглушить цель на 1 ход.',
  },
  armor_spiked_thorns: {
    name: 'Шипы',
    description: 'При получении урона в ближнем бою отражает 2 колющего урона атакующему.',
  },
  amulet_restore_ap_on_hit: {
    name: 'Второе дыхание',
    description: 'Атаки оружием ближнего боя имеют 15% шанс восстановить 1 ОД.',
  },
  amulet_fire_damage_multiplier: {
    name: 'Угольная искра',
    description: 'Огненные атаки оружием или способностью наносят на 2 урона больше.',
  },
};
