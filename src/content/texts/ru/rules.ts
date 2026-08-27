import type {ContentText} from '../types';

export const rules: Record<string, ContentText> = {
  item_fire_damage_multiplier: {
    name: 'Пылающий удар',
    description: 'Урон огнём увеличивается на 50%.',
  },
  weapon_poison_on_hit: {
    name: 'Ядовитое лезвие',
    description: 'Атаки колющим или рубящим уроном накладывают яд на 3 хода.',
  },
  weapon_blunt_daze: {
    name: 'Оглушающий удар',
    description: 'Атаки тупым уроном оглушают цель на 1 ход.',
  },
  weapon_bleeding_on_hit: {
    name: 'Кровопускание',
    description: 'Рубящие удары открывают кровотечение на 3 хода.',
  },
  weapon_bleeding_execute: {
    name: 'Добивание',
    description: 'Урон оружия по кровоточащим целям увеличен на 3.',
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
  prop_contains_flour_spills_on_death: {
    name: 'Рассыпанная мука',
    description: 'При уничтожении объекта с мукой она рассыпается вокруг облаком на 1 клетку.',
  },
  flammable_flour_bag_explodes_on_fire_death: {
    name: 'Взрыв горящего мешка',
    description: 'Если горящий мешок с мукой уничтожен, рассыпанная мука сразу детонирует.',
  },
  burning_tile_status_applied_deals_damage: {
    name: 'Вспышка пламени',
    description: 'При появлении горения на масле сущности на клетке получают 3 огненного урона.',
  },
  burning_tile_status_applied_applies_burning: {
    name: 'Поджог от пламени',
    description: 'При появлении горения на масле сущности на клетке загораются на 3 хода.',
  },
  // ── Правила реликвий стартового пула (roadmap 0.6) ─────────────────────────
  // Числа и условия сверены с определениями в simulation/content-rules/rules.ts.
  relic_salamander_heart_fire_infusion: {
    name: 'Огненное насыщение',
    description: 'Удары [оружия](tag:delivery.weapon) становятся [огненными](tag:damage.magical.fire): поджигают [масло](tag:effect.oil) и раздувают пожары.',
  },
  relic_salamander_heart_fire_vulnerability: {
    name: 'Уязвимость к огню',
    description: 'Входящий [огненный](tag:damage.magical.fire) урон по тебе увеличен на 25%.',
  },
  relic_venom_gland_poison_on_hit: {
    name: 'Отравляющий удар',
    description: 'Удары [оружия](tag:delivery.weapon) отравляют цель на 3 хода.',
  },
  relic_venom_gland_ramp_up: {
    name: 'Разгон',
    description: 'По неотравленной цели урон [оружия](tag:delivery.weapon) на 1 меньше.',
  },
  relic_acid_blood_poison_attacker: {
    name: 'Кислотная кровь',
    description: 'Атакующий тебя в [ближнем бою](tag:attack.melee) получает отравление на 2 хода.',
  },
  relic_plague_bearer_spread: {
    name: 'Разнос заразы',
    description: 'Удар [оружия](tag:delivery.weapon) по отравленной цели отравляет врагов рядом с ней на 2 хода.',
  },
  relic_plague_bearer_self_poison: {
    name: 'Обратный отсев',
    description: 'При разносе заразы ты получаешь отравление на 1 ход.',
  },
  relic_thunderhead_daze: {
    name: 'Громовой удар',
    description: '[Дробящие](tag:damage.physical.blunt) удары [оружия](tag:delivery.weapon) ошеломляют цель на 1 ход.',
  },
  relic_thunderhead_clumsy: {
    name: 'Неуклюжесть',
    description: 'Урон [оружия](tag:delivery.weapon) без [дробящего](tag:damage.physical.blunt) типа на 1 меньше.',
  },
  relic_opportunist_bonus: {
    name: 'Удар по слабому',
    description: 'Урон [оружия](tag:delivery.weapon) по ошеломлённым, оглушённым и отравленным целям увеличен на 3.',
  },
  relic_opportunist_hesitant: {
    name: 'Нерешительность',
    description: 'По противнику без ошеломления, оглушения и отравления урон [оружия](tag:delivery.weapon) на 1 меньше.',
  },
  relic_blood_pact_power: {
    name: 'Сила договора',
    description: 'Прямой исходящий урон от [оружия](tag:delivery.weapon) увеличен на 2.',
  },
  relic_blood_pact_price: {
    name: 'Цена договора',
    description: 'Прямой входящий урон от [оружия](tag:delivery.weapon) увеличен на 1.',
  },
  relic_scavenger_heal_on_pickup: {
    name: 'Радость находки',
    description: 'Поднятие предмета восстанавливает 5 HP.',
  },
};
