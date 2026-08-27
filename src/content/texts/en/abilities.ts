import type {ContentText} from '../types';

export const abilities: Record<string, ContentText> = {
  bulwark: {
    name: 'Bulwark',
    description: 'For 1 turn, become immune to all damage and [knockback](tag:effect.knockback), but unable to act. Status effects apply as usual. Costs 1 AP, cooldown 4.',
  },
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
    description: 'A [movement](tag:delivery.movement) leap to a cell within radius 2. The ground slam deals blunt damage to everyone around the landing cell and [knocks them back](tag:effect.knockback) (the landing cell itself is spared). Targeting a cell with a creature deals it double damage, [shoves](tag:effect.knockback) it to the nearest free cell, and you land in its place; if it cannot be shoved, you are thrown back instead. Costs 2 AP, cooldown 2.',
  },
  guardian_swoop: {
    name: 'Swoop',
    description: 'A [movement](tag:delivery.movement) leap to a cell within radius 3. The ground slam deals blunt damage to everyone around the landing cell and [knocks them back](tag:effect.knockback) (the landing cell itself is spared). Targeting a cell with a creature deals it double damage, [shoves](tag:effect.knockback) it to the nearest free cell, and you land in its place; if it cannot be shoved, you are thrown back instead. Costs 2 AP, cooldown 2.',
  },
  ground_slam: {
    name: 'Ground Slam',
    description: 'Slams the ground, dealing blunt damage to all creatures in a 5×5 square around the caster and dazing survivors for 2 turns. Costs 2 AP, cooldown 4.',
  },
  stone_throw: {
    name: 'Stone Throw',
    description: 'Hurl a stone at a visible target in a straight line (vertically, horizontally or diagonally) up to 5 cells away. Deals 3 blunt damage and [knocks it back](tag:effect.knockback) 1 cell. Costs 1 AP, cooldown 2.',
  },
  search: {
    name: 'Search',
    description: 'Survey the surroundings: reveals hidden traps within 3 cells in line of sight. Costs 1 AP even if nothing is found.',
  },
};
