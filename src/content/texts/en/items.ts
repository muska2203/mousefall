import type {ContentText} from '../types';

export const items: Record<string, ContentText> = {
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
  common_sling: {
    name: 'Sling',
    description: 'Ranged stone attack at 2–5 tiles; cannot strike up close. Thrown consumables fly 5 tiles farther.',
  },
  common_flaming_sword: {
    name: 'Charred Shortsword',
    description: 'Warm to the touch. The blade sputters with weak flames.',
  },
  common_venom_dagger: {
    name: 'Stinger Dagger',
    description: 'A narrow blade with a faint greenish residue.',
  },
  common_spiked_cloak: {
    name: 'Bramble Cloak',
    description: 'Woven from thorny vines. Hurts anyone who gets too close.',
  },
  common_ember_amulet: {
    name: 'Dull Ember Amulet',
    description: 'Holds a dying spark. Fire feels a little hotter around it.',
  },
  common_energized_bead: {
    name: 'Restless Bead',
    description: 'Tingles in your hand. Sometimes it gives a second wind mid-fight.',
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
  oil_bottle: {
    name: 'Oil Bottle',
    description: 'Throws a bottle of oil into a targeted area, creating an [oil](tag:effect.oil) tile effect.',
  },
  water_ball: {
    name: 'Water Ball',
    description: 'Throws a water ball into a targeted area, creating a [water](tag:effect.water) tile effect. Extinguishes fire and washes away oil.',
  },
  smoke_bomb: {
    name: 'Smoke Bomb',
    description: 'Throws a smoke bomb into a targeted area, creating a [smoke](tag:effect.smoke) tile effect that blocks line of sight.',
  },
  flour_pouch: {
    name: 'Flour Pouch',
    description: 'Throws a pouch of flour into a targeted area, creating a [flour cloud](tag:effect.flour_cloud): blocks line of sight and conceals anyone inside. Explodes when ignited.',
  },
  incendiary_bomb: {
    name: 'Incendiary Bomb',
    description: 'Throws an incendiary bomb into a targeted area. The explosion deals [fire](tag:damage.magical.fire) damage and ignites flammable materials.',
  },
  frag_bomb: {
    name: 'Frag Bomb',
    description: 'Throws a frag bomb into a targeted area. The explosion deals [piercing](tag:damage.physical.piercing) damage to everything in the area.',
  },
  cat_guardian_plate: {
    name: 'Cat Guardian Plate',
    description: 'A heavy plate forged from the scales of feline guardians.',
  },
  cat_guardian_maul: {
    name: 'Cat Guardian Maul',
    description: 'A massive blunt tool used to guard cheese vaults.',
  },
  unarmed: {
    name: 'Unarmed',
    description: 'Fists, teeth, and tail. Not glamorous, but free.',
  },
};
