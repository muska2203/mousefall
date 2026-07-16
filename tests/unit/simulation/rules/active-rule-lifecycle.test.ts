import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makePlayer, makeGameState } from '../../../fixtures/gameState';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { ItemTemplate, AbilityTemplate, StatusTemplate } from '../../../../src/content/schemas';
import type { RuntimeAbility } from '../../../../src/simulation/core-types';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { executeApplyStatusIntent } from '../../../../src/simulation/systems/intents/apply-status-intent-executer';
import {
  addActiveRulesForItem,
  removeActiveRulesForItem,
  addActiveRulesForStatus,
  removeActiveRulesForStatus,
  addActiveRulesForAbility,
  removeActiveRulesForAbility,
  rebuildActiveRules,
} from '../../../../src/simulation/systems/rules/active-rule-lifecycle';

function mockItem(id: string, ruleIds: string[] = []): ItemTemplate {
  return {
    id,
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    equipModifiers: [],
    grantedAbilities: [],
    ruleIds,
    apCost: 1,
  };
}

function mockAbility(id: string, ruleIds: string[] = []): AbilityTemplate {
  return {
    id,
    cooldown: 0,
    apCost: 1,
    aiPreparable: false,
    requiredWeaponTags: [],
    tags: [],
    ruleIds,
  };
}

function mockStatus(id: string, ruleIds: string[] = []): StatusTemplate {
  return {
    id,
    ruleIds,
    statusCategory: 'generic',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
  };
}

function makeBuilder() {
  return new ExecutionBuilder({
    type: 'ACTION_APPLIED',
    action: { type: 'END_TURN', entityId: 'any' },
  });
}

beforeEach(() => {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map(),
    items: new Map([
      ['test_item', mockItem('test_item', ['fire_damage_ignites'])],
    ]),
    abilities: new Map([
      ['test_ability', mockAbility('test_ability', ['item_fire_damage_multiplier'])],
    ]),
    statuses: new Map([
      ['burning', mockStatus('burning', ['fire_damage_ignites'])],
    ]),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
  });
});

afterEach(() => {
  resetRegistry();
});

describe('active-rule-lifecycle', () => {
  it('добавляет и удаляет правила предмета', () => {
    const player = makePlayer();

    addActiveRulesForItem(player, 'item_1', ['fire_damage_ignites']);

    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.id).toBe('fire_damage_ignites');
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: 'item_1',
    });

    removeActiveRulesForItem(player, 'item_1');

    expect(player.activeRules).toHaveLength(0);
  });

  it('добавляет и удаляет правила статуса', () => {
    const player = makePlayer();

    addActiveRulesForStatus(player, 'status_inst_1', 'burning');

    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.id).toBe('fire_damage_ignites');
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: 'status_inst_1',
      statusInstanceId: 'status_inst_1',
    });

    removeActiveRulesForStatus(player, 'status_inst_1');

    expect(player.activeRules).toHaveLength(0);
  });

  it('добавляет и удаляет правила способности', () => {
    const player = makePlayer();
    const ability: RuntimeAbility = {
      templateId: 'test_ability',
      source: 'innate',
      level: 1,
      currentCooldown: 0,
    };

    addActiveRulesForAbility(player, ability);

    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.id).toBe('item_fire_damage_multiplier');
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: 'test_ability',
    });

    removeActiveRulesForAbility(player, ability);

    expect(player.activeRules).toHaveLength(0);
  });

  it('rebuildActiveRules собирает правила от экипировки, статусов и способностей', () => {
    const player = makePlayer({
      inventory: [
        {
          instanceId: 'item_1',
          templateId: 'test_item',
          quantity: 1,
          grantedAbilities: [],
        },
      ],
      equippedWeaponInstanceId: 'item_1',
      statusEffects: [
        {
          type: 'burning',
          duration: 3,
          value: 0,
          statModifiers: null,
          instanceId: 'status_inst_1',
        },
      ],
      abilities: [
        {
          templateId: 'test_ability',
          source: 'innate',
          level: 1,
          currentCooldown: 0,
        },
      ],
      activeRules: [],
    });

    rebuildActiveRules(player);

    expect(player.activeRules).toHaveLength(3);
    expect(
      player.activeRules.some(
        (r) =>
          r.ownerContext.type === 'entity' && r.ownerContext.entityId === 'item_1',
      ),
    ).toBe(true);
    expect(
      player.activeRules.some(
        (r) =>
          r.ownerContext.type === 'entity' &&
          r.ownerContext.entityId === 'status_inst_1',
      ),
    ).toBe(true);
    expect(
      player.activeRules.some(
        (r) =>
          r.ownerContext.type === 'entity' &&
          r.ownerContext.entityId === 'test_ability',
      ),
    ).toBe(true);
  });

  it('rebuildActiveRules не дублирует правила у игрока с inventory и equippedWeaponId', () => {
    const player = makePlayer({
      inventory: [
        {
          instanceId: 'item_1',
          templateId: 'test_item',
          quantity: 1,
          grantedAbilities: [],
        },
      ],
      equippedWeaponInstanceId: 'item_1',
      equippedWeaponId: 'test_item',
      activeRules: [],
    });

    rebuildActiveRules(player);

    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.id).toBe('fire_damage_ignites');
  });

  it('не дублирует правило от одного ownerContext, но сохраняет от разных', () => {
    const player = makePlayer();

    addActiveRulesForItem(player, 'item_1', ['fire_damage_ignites']);
    addActiveRulesForItem(player, 'item_1', ['fire_damage_ignites']);

    expect(player.activeRules).toHaveLength(1);

    addActiveRulesForItem(player, 'item_2', ['fire_damage_ignites']);

    expect(player.activeRules).toHaveLength(2);
    expect(
      player.activeRules.every((r) => r.id === 'fire_damage_ignites'),
    ).toBe(true);
  });

  it('не пересоздаёт activeRules при обновлении длительности статуса', () => {
    const player = makePlayer();
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });

    executeApplyStatusIntent(
      state,
      {
        type: 'APPLY_STATUS',
        entityId: player.id,
        sourceEntityId: null,
        status: {
          type: 'burning',
          duration: 3,
          value: 0,
          statModifiers: null,
        },
      },
      makeBuilder(),
      makeBuilder().root,
    );

    expect(player.statusEffects).toHaveLength(1);
    expect(player.activeRules).toHaveLength(1);

    const instanceId = player.statusEffects[0]!.instanceId;
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: instanceId,
      statusInstanceId: instanceId,
    });

    executeApplyStatusIntent(
      state,
      {
        type: 'APPLY_STATUS',
        entityId: player.id,
        sourceEntityId: null,
        status: {
          type: 'burning',
          duration: 5,
          value: 0,
          statModifiers: null,
        },
      },
      makeBuilder(),
      makeBuilder().root,
    );

    expect(player.statusEffects).toHaveLength(1);
    expect(player.statusEffects[0]!.duration).toBe(5);
    expect(player.statusEffects[0]!.instanceId).toBe(instanceId);
    expect(player.activeRules).toHaveLength(1);
    expect(player.activeRules[0]!.ownerContext).toEqual({
      type: 'entity',
      entityId: instanceId,
      statusInstanceId: instanceId,
    });
  });
});
