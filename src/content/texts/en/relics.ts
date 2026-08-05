import type {ContentText} from '../types';

/**
 * Тексты реликвий стартового пула (roadmap 0.6).
 * Зеркальный перевод `texts/ru/relics.ts`: у реликвии — имя и атмосферный текст;
 * описание механики живёт в текстах правил (`texts/en/rules.ts`).
 */
export const relics: Record<string, ContentText> = {
  relic_salamander_heart: {
    name: 'Ember from Behind the Stove',
    flavorText: 'The mistress of the house has been hunting this ember for three days. Let her hunt — you found it first.',
  },
  relic_venom_gland: {
    name: 'Toadstool Gland',
    flavorText: 'Taken from a toadstool in fair combat. The toadstool did not object.',
  },
  relic_acid_blood: {
    name: 'Rusty Blood',
    flavorText: 'Nails for breakfast, bolts for lunch. No doctor comes down to this basement anyway.',
  },
  relic_plague_bearer: {
    name: 'Gray Murrain Carrier',
    flavorText: 'The gray murrain does not ask who you are. The gray murrain welcomes everyone.',
  },
  relic_thunderhead: {
    name: 'Thunder Bucket',
    flavorText: 'Thunder used to be sold by the bucket. You took the whole pail — cheap, no questions asked.',
  },
  relic_opportunist: {
    name: 'Sneaky Bite',
    flavorText: 'The noble fight fair. The noble also die first.',
  },
  relic_blood_pact: {
    name: 'Pact with the Basement',
    flavorText: 'No signature required. The basement simply knows you will be back.',
  },
  relic_scavenger: {
    name: 'Scrapyard Thrill',
    flavorText: 'One mouse throws it away, another carries it across the whole basement with its tail held high.',
  },
};
