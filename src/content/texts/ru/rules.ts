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
  prop_contains_oil_spills_on_death: {
    name: 'Разлитое масло',
    description: 'При уничтожении объекта с маслом оно разливается вокруг на 1 клетку.',
  },
  flammable_oil_barrel_explodes_on_fire_death: {
    name: 'Взрыв горящей бочки',
    description: 'Если горящая бочка с маслом уничтожена, разлитое масло сразу загорается и взрывается.',
  },
  burning_tile_status_applied_deals_damage: {
    name: 'Вспышка пламени',
    description: 'При появлении горения на масле сущности на клетке получают 3 огненного урона.',
  },
  burning_tile_status_applied_applies_burning: {
    name: 'Поджог от пламени',
    description: 'При появлении горения на масле сущности на клетке загораются на 3 хода.',
  },
};
