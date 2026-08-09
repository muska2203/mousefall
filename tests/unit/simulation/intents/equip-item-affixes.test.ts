/**
 * Тесты применения аффиксов экземпляра при экипировке/снятии.
 *
 * Stat-аффикс (фирменный или ролленный) превращается в модификатор с источником
 * `item_{instanceId}`; снятие предмета убирает его через removeModifiersBySource
 * (executeUnequipItemIntent). Rule-аффикс регистрирует контентное правило
 * в activeRules с ownerContext экземпляра предмета.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeGameState, makePlayer } from '../../../fixtures/gameState';
import { setContentRulesOverride, testSlashingBleedRule } from '../../../fixtures/content-rules';
import { executeEquipItemIntent } from '../../../../src/simulation/systems/intents/equip-item-intent-executor';
import { executeUnequipItemIntent } from '../../../../src/simulation/systems/intents/unequip-item-intent-executor';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { ItemTemplate, ModifierTemplate } from '../../../../src/content/schemas';
import { ExecutionBuilder } from '../../../../src/simulation/systems/actions/types';
import { getEffectiveMaxHp } from '../../../../src/simulation/systems/stats/effective-stats';

const testArmor = {
  id: 'test_armor',
  type: 'armor',
  subtype: 'light',
  level: 1,
  stackable: false,
  maxStack: 1,
  value: 0,
  rarity: 'common',
  abilityPool: [],
  fixedModifiers: ['test_sturdy'],
  grantedAbilities: [],
  apCost: 1,
  armor: { baseArmor: 2 },
} as ItemTemplate;

/** Фирменный stat-модификатор: детерминированные +10 к максимуму здоровья. */
const sturdyModifier: ModifierTemplate = {
  id: 'test_sturdy',
  polarity: 'positive',
  effect: { kind: 'stat', stat: 'maxHp', op: 'add' },
  scaling: { kind: 'fixed', value: 10 },
  applicableSubtypes: ['light'],
  poolEligible: false,
  weight: 1,
};

/** Фирменный rule-модификатор: добавляет правило slashing_weapon_bleed. */
const bleedModifier: ModifierTemplate = {
  id: 'test_bleed',
  polarity: 'positive',
  effect: { kind: 'rule', ruleId: 'slashing_weapon_bleed' },
  scaling: { kind: 'none' },
  applicableSubtypes: ['light'],
  poolEligible: false,
  weight: 1,
};

function makeBuilder() {
  return new ExecutionBuilder({ type: 'ACTION_APPLIED', isFieldEvent: false, action: { type: 'END_TURN', entityId: 'any' } });
}

describe('экипировка предмета со stat-аффиксом', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map([['test_armor', testArmor]]),
      abilities: new Map(),
      maps: new Map(),
      doors: new Map(),
      stairs: new Map(),
      statuses: new Map(),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
      modifiers: new Map([
        ['test_sturdy', sturdyModifier],
        ['test_bleed', bleedModifier],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
    setContentRulesOverride(null);
  });

  function makePlayerWithAffixedArmor() {
    return makePlayer({
      baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
      inventory: [{
        instanceId: 'armor_1',
        templateId: 'test_armor',
        quantity: 1,
        grantedAbilities: [],
        affixes: [{ modifierId: 'test_sturdy', value: 10, origin: 'fixed' }],
      }],
    });
  }

  it('equip применяет фирменный stat-аффикс как модификатор с источником item_{instanceId}', () => {
    const player = makePlayerWithAffixedArmor();
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();
    const hpBefore = getEffectiveMaxHp(player);

    executeEquipItemIntent(
      state,
      { type: 'EQUIP_ITEM', entityId: 'player', itemInstanceId: 'armor_1', slot: 'armor' },
      builder,
      builder.root,
    );

    expect(player.statModifiers).toContainEqual({
      stat: 'maxHp',
      value: 10,
      op: 'add',
      source: 'item_armor_1',
    });
    expect(getEffectiveMaxHp(player)).toBe(hpBefore + 10);
  });

  it('unequip снимает модификатор фирменного аффикса вместе с предметом', () => {
    const player = makePlayerWithAffixedArmor();
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    executeEquipItemIntent(
      state,
      { type: 'EQUIP_ITEM', entityId: 'player', itemInstanceId: 'armor_1', slot: 'armor' },
      builder,
      builder.root,
    );
    const hpWithAffix = getEffectiveMaxHp(player);

    executeUnequipItemIntent(
      state,
      { type: 'UNEQUIP_ITEM', entityId: 'player', slot: 'armor' },
      builder,
      builder.root,
    );

    expect(player.statModifiers.some((m) => m.source === 'item_armor_1')).toBe(false);
    expect(getEffectiveMaxHp(player)).toBe(hpWithAffix - 10);
  });

  it('equip регистрирует правило из фирменного rule-модификатора в activeRules', () => {
    setContentRulesOverride([testSlashingBleedRule]);
    const player = makePlayer({
      inventory: [{
        instanceId: 'armor_1',
        templateId: 'test_armor',
        quantity: 1,
        grantedAbilities: [],
        affixes: [{ modifierId: 'test_bleed', value: null, origin: 'fixed' }],
      }],
    });
    const state = makeGameState({ player, entities: new Map([['player', player]]) });
    const builder = makeBuilder();

    executeEquipItemIntent(
      state,
      { type: 'EQUIP_ITEM', entityId: 'player', itemInstanceId: 'armor_1', slot: 'armor' },
      builder,
      builder.root,
    );

    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.id).toBe('slashing_weapon_bleed');
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: 'armor_1',
    });

    executeUnequipItemIntent(
      state,
      { type: 'UNEQUIP_ITEM', entityId: 'player', slot: 'armor' },
      builder,
      builder.root,
    );

    expect(player.activeRules).toHaveLength(0);
  });
});
