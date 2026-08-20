import type {ContentText} from '../types';

export const stairs: Record<string, ContentText> = {
  stairs_down: {
    name: 'Лестница вниз',
    flavorText: 'Ведёт в ещё более противную вонь.',
  },
  stairs_up: {
    name: 'Лестница вверх',
    flavorText: 'Обратно к солнечному свету и неоплаченным счетам.',
  },
};

export const doors: Record<string, ContentText> = {
  wooden_door: {
    name: 'Деревянная дверь',
    flavorText: 'Хрупкая, но лучше, чем ничего.',
  },
  boss_door: {
    name: 'Массивная дверь',
    flavorText: 'Не взломать и не сжечь. За ней ждёт что-то большое.',
  },
};

export const props: Record<string, ContentText> = {
  oil_barel: {
    name: 'Бочка с маслом',
    flavorText: 'Деревянная, потрескавшаяся, с характерным запахом. Не бейте огнём.',
  },
  flour_bag: {
    name: 'Мешок с мукой',
    flavorText: 'Пыльный холщовый мешок. Разорвётся белым облаком — и берегись искры.',
  },
};

export const pois: Record<string, ContentText> = {
  altar: {
    name: 'Сырный куст',
    flavorText: 'Редкое подземное растение, плодоносящее чистым чеддером. Оторви ломтик — и жизнь сразу налаживается. Врачи его, правда, не признают.',
  },
  relic_altar: {
    name: 'Алтарь реликвий',
    flavorText: 'Древний каменный алтарь, источающий слабое свечение. Предлагает выбор: одну реликвию из трёх.',
  },
};

export const traps: Record<string, ContentText> = {
  spikes: {
    name: 'Колючки',
    flavorText: 'Ржавые шипы, спрятанные в полу. Уже поздно.',
  },
};
