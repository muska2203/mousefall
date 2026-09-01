import type {ContentText} from '../types';

export const modifiers: Record<string, ContentText> = {
  mod_sturdy_armor: {
    name: 'Sturdy',
    description: 'Armor increased by {value}.',
  },
  mod_poison_on_hit: {
    name: 'Venomous',
    description: 'Hits with this weapon poison the target.',
  },
  mod_fragile: {
    name: 'Fragile',
    description: 'Maximum health: {value}.',
  },
  mod_dull: {
    name: 'Dull',
    description: 'Damage: {value}.',
  },
  mod_blunt_daze: {
    name: 'Dazing',
    description: 'Blunt attacks daze the target for 1 turn.',
  },
  mod_blood_on_hit: {
    name: 'Rending',
    description: 'Slashing hits with this weapon open bleeding wounds for 3 turns.',
  },
  mod_blood_execute: {
    name: 'Executing',
    description: 'Hits with this weapon deal 3 additional damage to bleeding targets.',
  },
  mod_blood_widening_wound: {
    name: 'Jagged Edges',
    description: 'Striking an already bleeding target extends its bleeding to 5 turns.',
  },
  mod_blood_thorns: {
    name: 'Blood Thorns',
    description: 'When hit by a melee attack, opens a bleeding wound on the attacker for 2 turns.',
  },
  mod_blood_frenzy: {
    name: 'Frenzy',
    description: 'Weapon damage is increased by {value} while you are bleeding.',
  },
  mod_fire_damage_multiplier: {
    name: 'Flaming',
    description: 'Fire damage is increased by 50%.',
  },
  mod_spiked_thorns: {
    name: 'Spiked',
    description: 'When hit by a melee attack, reflects 2 piercing damage back to the attacker.',
  },
  mod_amulet_fire_damage_multiplier: {
    name: 'Ember',
    description: 'Fire attacks made with a weapon or ability deal 2 additional damage.',
  },
  mod_restore_ap_on_hit: {
    name: 'Invigorating',
    description: 'Melee weapon attacks have a 15% chance to restore 1 AP.',
  },
  mod_guardian_vitality: {
    name: 'Guardian\'s',
    description: 'Maximum health: +{value}.',
  },
  mod_sling_throw_range: {
    name: 'Far-reaching',
    description: 'Consumable throw range: +{value}.',
  },
};
