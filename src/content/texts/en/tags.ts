import type { ContentText } from '../types';

export const tags: Record<string, ContentText> = {
  'attack.melee': {
    name: 'Melee',
    description: 'Melee-range attack',
  },
  'attack.ranged': {
    name: 'Ranged',
    description: 'Ranged attack',
  },
  'target.single': {
    name: 'Single Target',
    description: 'Hits a single target',
  },
  'target.aoe': {
    name: 'Area',
    description: 'Hits multiple targets in a radius',
  },
  'target.multi': {
    name: 'Multi Target',
    description: 'Hits multiple selected targets',
  },
  'target.self': {
    name: 'Self',
    description: 'Affects self only',
  },
  'delivery.weapon': {
    name: 'Weapon',
    description: 'Weapon strike',
  },
  'delivery.spell': {
    name: 'Spell',
    description: 'Magical effect',
  },
  'delivery.projectile': {
    name: 'Projectile',
    description: 'Flying projectile',
  },
  'delivery.movement': {
    name: 'Movement',
    description: 'Includes movement',
  },
  'effect.knockback': {
    name: 'Knockback',
    description: 'Target may be pushed away',
  },
  'effect.burn': {
    name: 'Burn',
    description: 'Applies burning',
  },
  'buff.reactive': {
    name: 'Reactive',
    description: 'Reactive buff',
  },
  'damage.physical.slashing': {
    name: 'Slashing',
    description: 'Physical slashing damage',
  },
  'damage.physical.piercing': {
    name: 'Piercing',
    description: 'Physical piercing damage',
  },
  'damage.physical.blunt': {
    name: 'Blunt',
    description: 'Physical blunt damage',
  },
  'damage.magical.fire': {
    name: 'Fire',
    description: 'Magical fire damage',
  },
  'damage.magical.electric': {
    name: 'Electric',
    description: 'Magical electric damage',
  },
  'damage.physical': {
    name: 'Physical Damage',
    description: 'Physical class damage',
  },
  'damage.magical': {
    name: 'Magical Damage',
    description: 'Magical class damage',
  },
  'damage': {
    name: 'Damage',
    description: 'Damage classification tags',
  },
  attack: {
    name: 'Attack',
    description: 'Attack classification tags',
  },
  target: {
    name: 'Target',
    description: 'Attack target classification tags',
  },
  delivery: {
    name: 'Delivery',
    description: 'How the effect or damage is delivered',
  },
  'delivery.unarmed': {
    name: 'Unarmed',
    description: 'Attack without an equipped weapon',
  },
  effect: {
    name: 'Effect',
    description: 'Additional attack or ability effect',
  },
  buff: {
    name: 'Buff',
    description: 'Positive effect on an actor',
  },
  reaction: {
    name: 'Reaction',
    description: 'Reactive effect triggered by an event',
  },
  'reaction.counter': {
    name: 'Counter',
    description: 'Strike back in response to an attack',
  },
};
