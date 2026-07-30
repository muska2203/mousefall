import type {ContentText} from '../types';

export const terrain: Record<string, ContentText> = {
  floor: {
    name: 'Stone Floor',
    flavorText: 'Cold and creaky. Best not to inspect the stains.',
  },
  wall: {
    name: 'Stone Wall',
    flavorText: 'Solid masonry. Even the rats go around it.',
  },
  sand: {
    name: 'Sand',
    flavorText: 'Sifts in from every crack. Twice as hard to walk on.',
  },
};
