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
  // Blood-branch relics (stage 3 of docs/plans/bleed-builds-implementation.md).
  relic_blood_leech: {
    name: 'Leech',
    flavorText: 'It latched on long ago and has no plans to let go. At least it shares.',
  },
  relic_blood_echo: {
    name: 'Blood Echo',
    flavorText: 'Every spilled drop comes back. The only question is — to whom.',
  },
  relic_blood_reaper: {
    name: 'Reaper',
    flavorText: 'The basement loves those who clean up after themselves. And frowns at those who leave meals unfinished.',
  },
  relic_blood_fuel: {
    name: 'Blood Fuel',
    flavorText: 'The heart beats faster as the blood runs low. A strange economy.',
  },
  relic_blood_rupture: {
    name: 'Rupturer',
    flavorText: 'Fill a foe with blood to the brim — and it will share with everyone around. Everyone.',
  },
};
