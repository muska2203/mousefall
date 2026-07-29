import type {ContentText} from '../types';

export const rules: Record<string, ContentText> = {
  item_fire_damage_multiplier: {
    name: 'Flaming Strike',
    description: 'Fire damage is increased by 50%.',
  },
  weapon_poison_on_hit: {
    name: 'Venomous Blade',
    description: 'Piercing or slashing attacks have a 40% chance to apply poison for 3 turns.',
  },
  weapon_blunt_daze: {
    name: 'Dazing Blow',
    description: 'Blunt attacks have a 25% chance to daze the target for 1 turn.',
  },
  armor_spiked_thorns: {
    name: 'Thorns',
    description: 'When hit by a melee attack, reflects 2 piercing damage back to the attacker.',
  },
  amulet_restore_ap_on_hit: {
    name: 'Second Wind',
    description: 'Melee weapon attacks have a 15% chance to restore 1 AP.',
  },
  amulet_fire_damage_multiplier: {
    name: 'Ember Spark',
    description: 'Fire attacks made with a weapon or ability deal 2 additional damage.',
  },
  prop_contains_oil_spills_on_death: {
    name: 'Spilled Oil',
    description: 'When an oil-containing object is destroyed, oil spills in a 1-tile radius.',
  },
  flammable_oil_barrel_explodes_on_fire_death: {
    name: 'Burning Barrel Explosion',
    description: 'If a burning oil barrel is destroyed, the spilled oil immediately ignites and explodes.',
  },
  burning_tile_status_applied_deals_damage: {
    name: 'Flame Burst',
    description: 'When oil ignites, creatures on the tile take 3 fire damage.',
  },
  burning_tile_status_applied_applies_burning: {
    name: 'Ignited by Flames',
    description: 'When oil ignites, creatures on the tile catch fire for 3 turns.',
  },
};
