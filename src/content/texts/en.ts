import type { ContentTexts } from './types';

export const enContentTexts: ContentTexts = {
  items: {
    cat_claw_small: {
      name: 'Tiny Claw',
      description: 'Sharp but small. Just like its owner.',
    },
    cat_claw_mid: {
      name: 'Street Claw',
      description: 'A jagged claw with asphalt residue.',
    },
    cat_claw_big: {
      name: 'Boss Claw',
      description: 'A heavy claw capable of scratching armor.',
    },
    common_splinter_blade: {
      name: 'Rusty Cheesecutter',
      description: 'A small blunt blade that smells of cheese.',
    },
    common_school_wand: {
      name: 'Cracked Spoke',
      description: 'Almost a wand. Almost magical.',
    },
    common_patch_cloak: {
      name: 'Worn Dust Cloak',
      description: 'Smells of dust and secrets.',
    },
    common_tin_plate: {
      name: 'Tin Breastplate',
      description: 'Clanks when walking, but better than nothing.',
    },
    common_glass_bead: {
      name: 'Dull Bead',
      description: 'It seems there was once light in it.',
    },
    common_knotted_fang: {
      name: 'Crooked Fang',
      description: 'Someone wore it around their neck. Now you do.',
    },
    health_potion: {
      name: 'Health Potion',
      description: 'A small vial of red liquid. Restores 30 HP.',
    },
  },
  entities: {
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
  },
  abilities: {
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
      description: 'A [movement](tag:delivery.movement) leap to a free cell within radius 2. The ground slam wounds all enemies around the landing point, dealing blunt damage (scales with STR), and [knocks them back](tag:effect.knockback). Costs 2 AP, cooldown 2.',
    },
  },
  players: {
    'elven-ranger': {
      name: 'Pointy-Ear',
      description: 'An archer from the depths of the Cheese Forests.',
    },
    'halfling-mage': {
      name: 'Cheesy Merlin',
      description: 'A cunning spellcaster who turns cheese into mana.',
    },
    necromancer: {
      name: 'Mouse-Boneripper',
      description: 'A dark necromancer, lord of mold.',
    },
    'orc-barbarian': {
      name: 'Fangtail',
      description: 'A ferocious warrior with cheese fangs.',
    },
    paladin: {
      name: 'Sir Cheddar',
      description: 'A noble knight of the Cheese Order.',
    },
    samurai: {
      name: 'Whiskered Sensei',
      description: 'Master of the cheese blade.',
    },
    witcher: {
      name: 'White Tail',
      description: 'A monster hunter and alchemist-swordsman.',
    },
  },
  stairs: {
    stairs_down: {
      name: 'Stairs Down',
      flavorText: 'Leads to an even more foul stench.',
    },
    stairs_up: {
      name: 'Stairs Up',
      flavorText: 'Back to sunlight and unpaid bills.',
    },
  },
  doors: {
    wooden_door: {
      name: 'Wooden Door',
      flavorText: 'Fragile, but better than nothing.',
    },
  },
  tags: {
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
  },
};
