import type {ContentText} from '../types';

export const statuses: Record<string, ContentText> = {
  burning: {
    name: 'Burning',
    description: 'Deals fire damage every turn.',
  },
  counterattack: {
    name: 'Counterattack',
    description: 'Chance to strike back against a melee attack.',
  },
  dazed: {
    name: 'Dazed',
    description: 'Skips the next turn.',
  },
  frozen: {
    name: 'Frozen',
    description: 'Cannot move or attack.',
  },
  poisoned: {
    name: 'Poisoned',
    description: 'Deals poison damage every turn.',
  },
  regenerating: {
    name: 'Regenerating',
    description: 'Restores health every turn.',
  },
  silenced: {
    name: 'Silenced',
    description: 'Cannot use abilities.',
  },
  stunned: {
    name: 'Stunned',
    description: 'Cannot take actions.',
  },
  wet: {
    name: 'Wet',
    description: 'Extinguishes burning and washes away oil.',
  },
  oiled: {
    name: 'Oiled',
    description: 'Vulnerable to fire.',
  },
};
