import type {ContentText} from '../types';

export const entities: Record<string, ContentText> = {
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
  cat_guardian: {
    name: 'Кот-страж',
    flavorText: 'Древний часовой сырных тронов. Не любит незваных гостей.',
  },
};
