import type {ContentText} from '../types';

export const items: Record<string, ContentText> = {
  weapon_sword_splinter_blade: {
    name: 'Jagged Cheesecutter',
    description: 'A serrated cheese knife. The cuts are shallow but bleed for a long time.',
  },
  weapon_sword_hat_pin: {
    name: 'Hat Pin',
    description: "A long needle from the master's hat. In precise paws — a duelist's rapier.",
  },
  weapon_staff_school_wand: {
    name: 'Cracked Spoke',
    description: 'Almost a wand. Almost magical.',
  },
  weapon_sling: {
    name: 'Sling',
    description: 'Ranged stone attack at 2–5 tiles; cannot strike up close.',
  },
  weapon_sword_flaming: {
    name: 'Charred Shortsword',
    description: 'Warm to the touch. The blade sputters with weak flames.',
  },
  weapon_dagger_venom: {
    name: 'Stinger Dagger',
    description: 'A narrow blade, good for quick jabs.',
  },
  armor_light_spiked_cloak: {
    name: 'Bramble Cloak',
    description: 'Woven from thorny vines. Hurts anyone who gets too close.',
  },
  amulet_charm_ember: {
    name: 'Dull Ember Amulet',
    description: 'Holds a dying spark.',
  },
  amulet_bead_energized: {
    name: 'Restless Bead',
    description: 'Tingles in your hand.',
  },
  armor_light_patch_cloak: {
    name: 'Worn Dust Cloak',
    description: 'Smells of dust and secrets.',
  },
  armor_heavy_tin_plate: {
    name: 'Tin Breastplate',
    description: 'Clanks when walking, but better than nothing.',
  },
  amulet_bead_glass: {
    name: 'Dull Bead',
    description: 'It seems there was once light in it.',
  },
  amulet_talisman_knotted_fang: {
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
  blood_flask: {
    name: 'Blood Flask',
    description: 'Throws a flask of blood into a targeted area. It shatters into a [blood puddle](tag:effect.blood_puddle): anyone standing in it or stepping into it bleeds for 2 turns.',
  },
  ritual_cut: {
    name: 'Ritual Cut',
    description: 'Deals yourself a ritual wound: bleeding for 3 turns, but the battle trance grants +2 damage for 2 turns.',
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
