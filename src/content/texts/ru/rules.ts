import type { ContentText } from '../types';

export const rules: Record<string, ContentText> = {
  weapon_fire_damage_boost: {
    name: 'Огненный удар',
    description: 'Урон огнём от атак этого оружия увеличивается на 15%.',
  },
  weapon_poison_on_hit: {
    name: 'Ядовитое лезвие',
    description: 'Атаки колющим уроном имеют 40% шанс наложить яд на 3 хода.',
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
    description: 'Весь огненный урон увеличивается на 15%.',
  },
};
