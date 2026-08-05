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
    description: 'All damage you deal is increased by 4.',
  },
  relic_blood_pact_price: {
    name: 'Pact Price',
    description: 'Incoming damage against you is increased by 25%.',
  },
  relic_scavenger_heal_on_pickup: {
    name: 'Thrill of the Find',
    description: 'Picking up an item restores 5 HP.',
  },
};
