import { describe, expect, it } from 'vitest';
import { makeGameState, makeEnemy } from '../../../fixtures/gameState';
import { executeApplyStatusIntent } from '../../../../src/simulation/systems/intents/apply-status-intent-executer';
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

describe('apply-status-intent-executer', () => {
  it('updates duration when same non-stackable effect is applied', () => {
    const enemy = makeEnemy({ statusEffects: [makeStatus('frozen', 1)] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, effect: makeStatus('frozen', 3) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, status: makeStatus('frozen', 3) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.duration).toBe(3);
    expect(enemy.statusEffects[0]!.stacks).toBeUndefined();
  });

  it('updates duration when counterattack is reapplied without stacks', () => {
    const enemy = makeEnemy({ statusEffects: [makeStatus('counterattack', 1)] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, effect: makeStatus('counterattack', 2) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, status: makeStatus('counterattack', 2) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.type).toBe('counterattack');
    expect(enemy.statusEffects[0]!.duration).toBe(2);
    expect(enemy.statusEffects[0]!.stacks).toBeUndefined();
  });

  it('adds new effect if type does not exist', () => {
    const enemy = makeEnemy({ statusEffects: [] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_APPLIED', entityId: enemy.id, effect: makeStatus('counterattack', 2) });
    executeApplyStatusIntent(state, { type: 'APPLY_STATUS', entityId: enemy.id, status: makeStatus('counterattack', 2) }, builder, builder.root);

    expect(enemy.statusEffects).toHaveLength(1);
    expect(enemy.statusEffects[0]!.type).toBe('counterattack');
    expect(enemy.statusEffects[0]!.duration).toBe(2);
  });
});
