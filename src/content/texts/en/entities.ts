import type { ContentText } from '../types';

export const entities: Record<string, ContentText> = {
  cat_small: {
    name: 'Kitten Bandit',
    flavorText: 'Yesterday it was meowing under the window. Today it robs caravans.',
  },
  cat_mid: {
    name: 'Street Cat',
    flavorText: 'A mid-sized business cat. Hires kittens and pays no taxes.',
  },
  cat_big: {
    name: 'Boss Cat',
    flavorText: 'The main cat of the district. Its rattling purr can be heard three blocks away.',
  },
  cat_guardian: {
    name: 'Cat Guardian',
    flavorText: 'An ancient sentinel of cheese thrones. Dislikes uninvited guests.',
  },
};
