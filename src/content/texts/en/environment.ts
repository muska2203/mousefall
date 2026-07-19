import type {ContentText} from '../types';

export const stairs: Record<string, ContentText> = {
  stairs_down: {
    name: 'Stairs Down',
    flavorText: 'Leads to an even more foul stench.',
  },
  stairs_up: {
    name: 'Stairs Up',
    flavorText: 'Back to sunlight and unpaid bills.',
  },
};

export const doors: Record<string, ContentText> = {
  wooden_door: {
    name: 'Wooden Door',
    flavorText: 'Fragile, but better than nothing.',
  },
};
