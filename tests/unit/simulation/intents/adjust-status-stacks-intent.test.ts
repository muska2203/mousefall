import { describe, expect, it } from 'vitest';
import { makeGameState, makeEnemy } from '../../../fixtures/gameState';
import { executeAdjustStatusStacksIntent } from '../../../../src/simulation/systems/intents/adjust-status-stacks-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import type { StatusEffect } from '../../../../src/simulation/core-types';

function makeStatus(type: StatusEffect['type'], duration: number, stacks?: number): StatusEffect {
  return {
    type,
    duration,
    value: 0,
    statModifiers: null,
    ...(stacks !== undefined ? { stacks } : {}),
  };
}

describe('adjust-status-stacks-intent-executer', () => {
  it('decreases stacks and emits STATUS_STACKS_ADJUSTED', () => {
    const enemy = makeEnemy({ statusEffects: [makeStatus('parry', 1, 3)] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_STACKS_ADJUSTED', entityId: enemy.id, statusType: 'parry', stacks: 2 });
    const node = executeAdjustStatusStacksIntent(
      state,
      { type: 'ADJUST_STATUS_STACKS', entityId: enemy.id, statusType: 'parry', delta: -1 },
      builder,
      builder.root,
    );

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.stacks).toBe(2);
    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('STATUS_STACKS_ADJUSTED');
    expect(node!.event).toMatchObject({ entityId: enemy.id, statusType: 'parry', stacks: 2 });
  });

  it('removes status and emits STATUS_REMOVED when stacks reach 0', () => {
    const enemy = makeEnemy({ statusEffects: [makeStatus('parry', 1, 1)] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_REMOVED', entityId: enemy.id, effectType: 'parry' });
    const node = executeAdjustStatusStacksIntent(
      state,
      { type: 'ADJUST_STATUS_STACKS', entityId: enemy.id, statusType: 'parry', delta: -1 },
      builder,
      builder.root,
    );

    expect(enemy.statusEffects).toHaveLength(0);
    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('STATUS_REMOVED');
    expect(node!.event).toMatchObject({ entityId: enemy.id, effectType: 'parry' });
  });

  it('treats missing stacks as 1', () => {
    const enemy = makeEnemy({ statusEffects: [{ type: 'parry', duration: 1, value: 0, statModifiers: null }] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_REMOVED', entityId: enemy.id, effectType: 'parry' });
    executeAdjustStatusStacksIntent(
      state,
      { type: 'ADJUST_STATUS_STACKS', entityId: enemy.id, statusType: 'parry', delta: -1 },
      builder,
      builder.root,
    );

    expect(enemy.statusEffects).toHaveLength(0);
  });

  it('does nothing if status is not present', () => {
    const enemy = makeEnemy({ statusEffects: [] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_STACKS_ADJUSTED', entityId: enemy.id, statusType: 'parry', stacks: 0 });
    const node = executeAdjustStatusStacksIntent(
      state,
      { type: 'ADJUST_STATUS_STACKS', entityId: enemy.id, statusType: 'parry', delta: -1 },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
    expect(enemy.statusEffects).toHaveLength(0);
  });
});
