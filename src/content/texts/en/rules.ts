import type {ContentText} from '../types';

export const rules: Record<string, ContentText> = {
  item_fire_damage_multiplier: {
    name: 'Flaming Strike',
    description: 'Fire damage is increased by 50%.',
  },
  weapon_poison_on_hit: {
    name: 'Venomous Blade',
    description: 'Piercing or slashing attacks apply poison for 3 turns.',
  },
  weapon_blunt_daze: {
    name: 'Dazing Blow',
    description: 'Blunt attacks daze the target for 1 turn.',
  },
  weapon_bleeding_on_hit: {
    name: 'Bloodletting',
    description: 'Slashing attacks open bleeding wounds for 3 turns.',
  },
  weapon_bleeding_execute: {
    name: 'Execution',
    description: 'Weapon damage against bleeding targets is increased by 3.',
  },
  weapon_bleeding_widening: {
    name: 'Jagged Edges',
    description: 'Striking an already bleeding target extends its bleeding to 5 turns.',
  },
  armor_bleeding_thorns: {
    name: 'Blood Thorns',
    description: 'When hit by a melee attack, opens a bleeding wound on the attacker for 2 turns.',
  },
  amulet_blood_frenzy: {
    name: 'Frenzy',
    description: '[Weapon](tag:delivery.weapon) damage is increased while you are bleeding.',
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
  prop_contains_flour_spills_on_death: {
    name: 'Scattered Flour',
    description: 'When a flour-containing object is destroyed, flour scatters in a cloud within a 1-tile radius.',
  },
  flammable_flour_bag_explodes_on_fire_death: {
    name: 'Burning Bag Explosion',
    description: 'If a burning flour bag is destroyed, the scattered flour detonates immediately.',
  },
  burning_tile_status_applied_deals_damage: {
    name: 'Flame Burst',
    description: 'When oil ignites, creatures on the tile take 3 fire damage.',
  },
  burning_tile_status_applied_applies_burning: {
    name: 'Ignited by Flames',
    description: 'When oil ignites, creatures on the tile catch fire for 3 turns.',
  },
  // ── Правила реликвий стартового пула (roadmap 0.6) ─────────────────────────
  // Зеркальный перевод `texts/ru/rules.ts`; тег-ссылки ведут на те же теги.
  relic_salamander_heart_fire_infusion: {
    name: 'Fire Infusion',
    description: 'Your [weapon](tag:delivery.weapon) strikes count as [fire](tag:damage.magical.fire): they ignite [oil](tag:effect.oil) and stoke flames.',
  },
  relic_salamander_heart_fire_vulnerability: {
    name: 'Fire Vulnerability',
    description: 'Incoming [fire](tag:damage.magical.fire) damage against you is increased by 25%.',
  },
  relic_venom_gland_poison_on_hit: {
    name: 'Poisoning Strike',
    description: '[Weapon](tag:delivery.weapon) strikes poison the target for 3 turns.',
  },
  relic_venom_gland_ramp_up: {
    name: 'Ramp-up',
    description: '[Weapon](tag:delivery.weapon) damage against unpoisoned targets is reduced by 1.',
  },
  relic_acid_blood_poison_attacker: {
    name: 'Acid Blood',
    description: 'Anyone striking you in [melee](tag:attack.melee) is poisoned for 2 turns.',
  },
  relic_plague_bearer_spread: {
    name: 'Plague Spread',
    description: 'Striking a poisoned target with a [weapon](tag:delivery.weapon) poisons enemies next to it for 2 turns.',
  },
  relic_plague_bearer_self_poison: {
    name: 'Backlash',
    description: 'When the plague spreads, you are poisoned for 1 turn.',
  },
  relic_thunderhead_daze: {
    name: 'Thunder Strike',
    description: '[Blunt](tag:damage.physical.blunt) [weapon](tag:delivery.weapon) strikes daze the target for 1 turn.',
  },
  relic_thunderhead_clumsy: {
    name: 'Clumsiness',
    description: '[Weapon](tag:delivery.weapon) damage without the [blunt](tag:damage.physical.blunt) type is reduced by 1.',
  },
  relic_opportunist_bonus: {
    name: 'Strike the Weak',
    description: '[Weapon](tag:delivery.weapon) damage against dazed, stunned, and poisoned targets is increased by 3.',
  },
  relic_opportunist_hesitant: {
    name: 'Hesitation',
    description: '[Weapon](tag:delivery.weapon) damage against foes without daze, stun, or poison is reduced by 1.',
  },
  relic_blood_pact_power: {
    name: 'Pact Power',
    description: 'Direct outgoing damage from your [weapon](tag:delivery.weapon) is increased by 2.',
  },
  relic_blood_pact_price: {
    name: 'Pact Price',
    description: 'Direct incoming damage from [weapons](tag:delivery.weapon) is increased by 1.',
  },
  relic_scavenger_heal_on_pickup: {
    name: 'Thrill of the Find',
    description: 'Picking up an item restores 5 HP.',
  },
  // Blood-branch relic rules (stage 3 of docs/plans/bleed-builds-implementation.md).
  relic_blood_leech_tick_heal: {
    name: 'Bloodsucking',
    description: 'Each bleeding tick of a creature next to you restores 1 HP.',
  },
  relic_blood_echo_heal_on_bleed_kill: {
    name: 'Contented Echo',
    description: 'Finishing off a bleeding enemy with your own strike restores 2 HP.',
  },
  relic_blood_echo_bleed_faded: {
    name: 'The Echo Craves Blood',
    description: 'Whenever anyone’s bleeding wears off, you take 1 internal damage.',
  },
  relic_blood_reaper_harvest: {
    name: 'Own Harvest',
    description: 'Finishing off a bleeding enemy with your own strike restores 1 AP.',
  },
  relic_blood_reaper_foreign_harvest: {
    name: 'Foreign Harvest',
    description: 'A bleeding enemy dies by another hand — you lose 1 AP.',
  },
  relic_blood_fuel_self_tick: {
    name: 'Blood for Fuel',
    description: 'Each tick of your own bleeding restores 1 AP.',
  },
  relic_blood_fuel_exsanguinated: {
    name: 'Exsanguinated',
    description: 'When your bleeding wears off, you lose 1 AP.',
  },
  relic_blood_rupture_detonation: {
    name: 'Rupture',
    description: 'A bleeding creature bursts on death: 4 internal damage to everyone within 1 tile, including you.',
  },
  relic_blood_rupture_bleed_splash: {
    name: 'Blood Splash',
    description: 'Survivors within the burst radius bleed for 2 turns.',
  },
  blood_puddle_applies_bleeding: {
    name: 'Blood Puddle',
    description: 'Stepping into a blood puddle opens a bleeding wound for 2 turns.',
  },
  blood_puddle_applies_bleeding_on_spawn: {
    name: 'Blood Puddle',
    description: 'A blood puddle appearing under a creature opens a bleeding wound for 2 turns.',
  },
};
