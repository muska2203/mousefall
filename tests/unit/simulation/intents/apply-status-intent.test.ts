import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makeEnemy } from '../../../fixtures/gameState';
import { executeApplyStatusIntent } from '../../../../src/simulation/systems/intents/apply-status-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import type { StatusEffect } from '../../../../src/simulation/core-types';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { StatusTemplate } from '../../../../src/content/schemas';

function makeStatus(type: StatusEffect['type'], duration: number, stacks?: number): StatusEffect {
  return {
    type,
    duration,
    value: 0,
    statModifiers: null,
    ...(stacks !== undefined ? { stacks } : {}),
  };
}

function mockStatusTemplate(overrides: Partial<StatusTemplate> & { id: string }): StatusTemplate {
  return {
    ruleIds: [],
    statusCategory: 'generic',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    ...overrides,
  };
}

describe('apply-status-intent-executer', () => {
  beforeEach(() => {
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
      doors: new Map(),
      statuses: new Map([
        ['burning', mockStatusTemplate({
          id: 'burning',
          statusCategory: 'elemental',
          categoryPriority: 1,
          mutuallyExclusiveWith: ['frozen'],
        })],
        ['frozen', mockStatusTemplate({
          id: 'frozen',
          statusCategory: 'elemental',
          categoryPriority: 1,
          mutuallyExclusiveWith: ['burning'],
        })],
        ['stunned', mockStatusTemplate({
          id: 'stunned',
          statusCategory: 'physical',
          categoryPriority: 2,
          mutuallyExclusiveWith: ['dazed'],
        })],
        ['dazed', mockStatusTemplate({
          id: 'dazed',
          statusCategory: 'physical',
          categoryPriority: 1,
          blockedBy: ['stunned'],
        })],
        ['silenced', mockStatusTemplate({ id: 'silenced', statusCategory: 'mental', categoryPriority: 0 })],
        ['counterattack', mockStatusTemplate({ id: 'counterattack', statusCategory: 'generic', categoryPriority: 0 })],
      ]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('updates duration when same non-stackable effect is applied', () => {
    const enemy = makeEnemy({ statusEffects: [makeStatus('frozen', 1)] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, sourceEntityId: null, effect: makeStatus('frozen', 3) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, sourceEntityId: null, status: makeStatus('frozen', 3) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.duration).toBe(3);
    expect(enemy.statusEffects[0]!.stacks).toBeUndefined();
  });

  it('updates duration when counterattack is reapplied without stacks', () => {
    const enemy = makeEnemy({ statusEffects: [makeStatus('counterattack', 1)] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, sourceEntityId: null, effect: makeStatus('counterattack', 2) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, sourceEntityId: null, status: makeStatus('counterattack', 2) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.type).toBe('counterattack');
    expect(enemy.statusEffects[0]!.duration).toBe(2);
    expect(enemy.statusEffects[0]!.stacks).toBeUndefined();
  });

  it('adds new effect if type does not exist', () => {
    const enemy = makeEnemy({ statusEffects: [] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, sourceEntityId: null, effect: makeStatus('counterattack', 2) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, sourceEntityId: null, status: makeStatus('counterattack', 2) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.type).toBe('counterattack');
    expect(enemy.statusEffects[0]!.duration).toBe(2);
  });

  it('cancels preparedAbility and emits ABILITY_PREPARED_CANCELLED when silenced is applied to enemy', () => {
    const enemy = makeEnemy({
      statusEffects: [],
      aiState: {
        strategy: 'hunter',
        mode: 'idle',
        targetX: null,
        targetY: null,
        homeX: 3,
        homeY: 3,
        preparedAbility: { abilityId: 'fireball', targets: [{ x: 5, y: 5 }] },
      },
    });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, sourceEntityId: null, effect: makeStatus('silenced', 1) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, sourceEntityId: null, status: makeStatus('silenced', 1) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.type).toBe('silenced');
    expect(enemy.aiState.preparedAbility).toBeNull();

    const cancelledEvent = builder.root.children.find(
      c => c.event.type === 'ABILITY_PREPARED_CANCELLED',
    );
    expect(cancelledEvent).toBeDefined();
    expect(cancelledEvent!.event).toMatchObject({
      type: 'ABILITY_PREPARED_CANCELLED',
      entityId: enemy.id,
      abilityId: 'fireball',
      targets: [{ x: 5, y: 5 }],
    });
  });

  it('does not emit ABILITY_PREPARED_CANCELLED when silenced is applied to enemy without preparedAbility', () => {
    const enemy = makeEnemy({ statusEffects: [] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, sourceEntityId: null, effect: makeStatus('silenced', 1) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, sourceEntityId: null, status: makeStatus('silenced', 1) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.type).toBe('silenced');

    const cancelledEvent = builder.root.children.find(
      c => c.event.type === 'ABILITY_PREPARED_CANCELLED',
    );
    expect(cancelledEvent).toBeUndefined();
  });

  it('blocks dazed when stunned is active and emits STATUS_BLOCKED', () => {
    const enemy = makeEnemy({ statusEffects: [makeStatus('stunned', 2)] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, sourceEntityId: null, effect: makeStatus('dazed', 2) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, sourceEntityId: null, status: makeStatus('dazed', 2) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.type).toBe('stunned');

    const blockedEvent = builder.root.children.find(c => c.event.type === 'STATUS_BLOCKED');
    expect(blockedEvent).toBeDefined();
    expect(blockedEvent!.event).toMatchObject({
      type: 'STATUS_BLOCKED',
      entityId: enemy.id,
      statusType: 'dazed',
      blockedBy: 'stunned',
    });
  });

  it('removes dazed via mutuallyExclusiveWith when stunned is applied', () => {
    const enemy = makeEnemy({ statusEffects: [makeStatus('dazed', 2)] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, sourceEntityId: null, effect: makeStatus('stunned', 2) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, sourceEntityId: null, status: makeStatus('stunned', 2) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.type).toBe('stunned');

    const removedEvent = builder.root.children.find(c => c.event.type === 'STATUS_REMOVED');
    expect(removedEvent).toBeDefined();
    expect(removedEvent!.event).toMatchObject({
      type: 'STATUS_REMOVED',
      entityId: enemy.id,
      effectType: 'dazed',
    });
  });

  it('removes frozen via mutuallyExclusiveWith when burning is applied', () => {
    const enemy = makeEnemy({ statusEffects: [makeStatus('frozen', 2)] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, sourceEntityId: null, effect: makeStatus('burning', 2) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, sourceEntityId: null, status: makeStatus('burning', 2) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.type).toBe('burning');

    const removedEvent = builder.root.children.find(c => c.event.type === 'STATUS_REMOVED');
    expect(removedEvent).toBeDefined();
    expect(removedEvent!.event).toMatchObject({
      type: 'STATUS_REMOVED',
      entityId: enemy.id,
      effectType: 'frozen',
    });
  });
});
