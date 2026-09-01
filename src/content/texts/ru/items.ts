import type {ContentText} from '../types';

export const items: Record<string, ContentText> = {
  weapon_sword_splinter_blade: {
    name: 'Зазубренный сырорез',
    description: 'Зубчатый нож для сыра. Раны от него неглубокие, но долго кровоточат.',
  },
  weapon_sword_hat_pin: {
    name: 'Шляпная булавка',
    description: 'Длинная игла от хозяйской шляпы. В точных лапах — шпага дуэлянта.',
  },
  weapon_staff_school_wand: {
    name: 'Треснувшая спица',
    description: 'Почти палочка. Почти волшебная.',
  },
  weapon_sling: {
    name: 'Праща',
    description: 'Дальняя атака камнем на расстоянии 2–5 клеток; в упор не бьёт.',
  },
  weapon_sword_flaming: {
    name: 'Обгоревший короткий меч',
    description: 'Тёплый на ощупь. Лезвие трещит слабым пламенем.',
  },
  weapon_dagger_venom: {
    name: 'Жалящий кинжал',
    description: 'Узкое лезвие, удобное для быстрых уколов.',
  },
  armor_light_spiked_cloak: {
    name: 'Плащ из колючего вьюнка',
    description: 'Сплетён из колючих лоз. Больно тем, кто подходит слишком близко.',
  },
  amulet_charm_ember: {
    name: 'Тусклый угольный амулет',
    description: 'Хранит угасающую искру.',
  },
  amulet_bead_energized: {
    name: 'Беспокойная бусина',
    description: 'Покалывает в ладони.',
  },
  armor_light_patch_cloak: {
    name: 'Потёртый плащ пыльника',
    description: 'Пахнет пылью и тайнами.',
  },
  armor_heavy_tin_plate: {
    name: 'Жестяная кираса',
    description: 'Гремит при ходьбе, но лучше чем ничего.',
  },
  amulet_bead_glass: {
    name: 'Тусклая бусина',
    description: 'Кажется, в ней когда-то был свет.',
  },
  amulet_talisman_knotted_fang: {
    name: 'Кривой клык',
    description: 'Кто-то носил его на шее. Теперь — вы.',
  },
  health_potion: {
    name: 'Зелье здоровья',
    description: 'Небольшой пузырёк с красной жидкостью. Восстанавливает 30 HP.',
  },
  oil_bottle: {
    name: 'Бутылка с маслом',
    description: 'Бросок бутыли с маслом в выбранную область. Создаёт на тайлах эффект [масла](tag:effect.oil).',
  },
  water_ball: {
    name: 'Водяной шар',
    description: 'Бросок водяного шара в выбранную область. Создаёт на тайлах эффект [воды](tag:effect.water). Тушит огонь и смывает масло.',
  },
  smoke_bomb: {
    name: 'Дымовая бомба',
    description: 'Бросок дымовой бомбы в выбранную область. Создаёт на тайлах эффект [дыма](tag:effect.smoke), блокирующий обзор.',
  },
  flour_pouch: {
    name: 'Мешочек муки',
    description: 'Бросок мешочка муки в выбранную область. Создаёт облако [взвешанной муки](tag:effect.flour_cloud): блокирует обзор и скрывает тех, кто внутри. Взрывается от огня.',
  },
  blood_flask: {
    name: 'Флакон крови',
    description: 'Бросок флакона с кровью в выбранную область. Разбивается [кровавой лужей](tag:effect.blood_puddle): все, кто в ней стоит или заходит, получают кровотечение на 2 хода.',
  },
  ritual_cut: {
    name: 'Ритуальный надрез',
    description: 'Наносит себе ритуальную рану: кровотечение на 3 хода, но боевой транс даёт +2 к урону на 2 хода.',
  },
  incendiary_bomb: {
    name: 'Зажигательная бомба',
    description: 'Бросок зажигательной бомбы в выбранную область. Взрыв наносит [огненный](tag:damage.magical.fire) урон и поджигает горючие материалы.',
  },
  frag_bomb: {
    name: 'Осколочная бомба',
    description: 'Бросок осколочной бомбы в выбранную область. Взрыв наносит [колющий](tag:damage.physical.piercing) урон всем в области.',
  },
  cat_guardian_plate: {
    name: 'Стражевая кошачья броня',
    description: 'Тяжёлая пластина, выкованная из чешуи котов-хранителей.',
  },
  cat_guardian_maul: {
    name: 'Стражевой кошачий молот',
    description: 'Массивный дробящий инструмент, которым охраняют сырные хранилища.',
  },
  unarmed: {
    name: 'Без оружия',
    description: 'Кулаки, зубы и хвост. Не блестяще, но бесплатно.',
  },
};
