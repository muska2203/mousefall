import type {ContentText} from '../types';

export const abilities: Record<string, ContentText> = {
  cleave: {
    name: 'Cleave',
    description: 'A [weapon](tag:delivery.weapon) swing in an arc near the hero. Hits the target cell and two adjacent cells: [melee](tag:attack.melee), [area](tag:target.aoe).',
  },
  dash: {
    name: 'Dash',
    description: 'A [movement](tag:delivery.movement) dash of 2 cells in a chosen direction. Opens closed doors. On collision with an enemy, deals blunt damage (scales with STR) and [knocks it back](tag:effect.knockback). Costs 1 AP, cooldown 4.',
  },
  fireball: {
    name: 'Fireball',
    description: 'A [ranged](tag:attack.ranged) fiery [projectile](tag:delivery.projectile) thrown at a visible point up to 5 cells away. The explosion in radius 1 deals fire damage and [burns](tag:effect.burn) targets for 3 turns. Costs 2 AP, cooldown 3.',
  },
  magic_slap: {
    name: 'Magic Slap',
    description: 'Up to three [ranged](tag:attack.ranged) lightning strikes on selected visible targets within 5 cells. Electric damage, scales with INT. Costs 1 AP, cooldown 2.',
  },
  oil_flask: {
    name: 'Oil Flask',
    description: 'Throws a flask of oil into a targeted area, creating an [oil](tag:effect.oil) tile effect. Costs 1 AP, cooldown 1.',
  },
  rain: {
    name: 'Rain',
    description: 'Summons a downpour in a targeted area, creating a [water](tag:effect.water) tile effect. Extinguishes fire and washes away oil. Costs 1 AP, cooldown 1.',
  },
  counterattack: {
    name: 'Counterattack',
    description: 'For 2 turns, gain a 50% chance to strike back against a [single-target](tag:target.single) [melee](tag:attack.melee) hit. Costs 2 AP, cooldown 4.',
  },
  sudden_strike: {
    name: 'Sudden Strike',
    description: 'A quick [weapon](tag:delivery.weapon) [melee](tag:attack.melee) attack against an adjacent enemy. If the target has a prepared ability, the preparation is interrupted and it is silenced for 2 turns. Costs 1 AP, cooldown 4.',
  },
  swoop: {
    name: 'Swoop',
    description: 'A [movement](tag:delivery.movement) leap to a free cell within radius 2. The ground slam wounds all enemies around the landing point, dealing blunt damage (scales with STR), and [knocks them back](tag:effect.knockback). Costs 2 AP, cooldown 2.',
  },
};
