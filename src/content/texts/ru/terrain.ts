import type {ContentText} from '../types';

export const terrain: Record<string, ContentText> = {
  floor: {
    name: 'Каменный пол',
    flavorText: 'Холодный, скрипучий, в пятнах лучше не разбираться.',
  },
  wall: {
    name: 'Каменная стена',
    flavorText: 'Монолитная кладка. Даже крысы обходят её стороной.',
  },
  sand: {
    name: 'Песок',
    flavorText: 'Сыпется из всех щелей. Идти по нему вдвое тяжелее.',
  },
};
