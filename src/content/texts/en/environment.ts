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
  boss_door: {
    name: 'Massive Door',
    flavorText: 'Cannot be broken or burned. Something big waits behind it.',
  },
};

export const props: Record<string, ContentText> = {
  oil_barel: {
    name: 'Oil Barrel',
    flavorText: "Wooden, cracked, and unmistakably greasy. Don't hit it with fire.",
  },
  flour_bag: {
    name: 'Flour Bag',
    flavorText: 'A dusty canvas sack. Tears open into a white cloud — mind the sparks.',
  },
};

export const pois: Record<string, ContentText> = {
  altar: {
    name: 'Cheese Bush',
    flavorText: 'A rare underground shrub that bears pure cheddar. Pick a slice and life instantly improves. Doctors remain skeptical.',
  },
  relic_altar: {
    name: 'Relic Altar',
    flavorText: 'An ancient stone altar radiating a faint glow. It offers a choice: one relic out of three.',
  },
};

export const traps: Record<string, ContentText> = {
  spikes: {
    name: 'Spikes',
    flavorText: 'Rusty spikes hidden in the floor. Too late now.',
  },
  mousetrap: {
    name: 'Mousetrap',
    flavorText: 'A cunning spring trap set by the feline guard. Snap — your paw is caught and the wound is bleeding.',
  },
};
