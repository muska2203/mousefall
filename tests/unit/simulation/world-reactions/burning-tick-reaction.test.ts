import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { executeIntent } from '../../../../src/simulation/systems/intents/execute-intent';

function makeBuilder(entityId: string) {
  return new ExecutionBuilder({
    type: 'STATUS_TICKED',
    entityId,
    effectTypes: [],
  });
}

function collectEvents(node: { event: unknown; children: unknown[] }): unknown[] {
  return [node.event, ...node.children.flatMap(child => collectEvents(child as { event: unknown; children: unknown[] }))];
}

describe('burning tick reaction', () => {
  it('produces fire DAMAGE when burning ticks', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 2, value: 10, statModifiers: null }] });
    state.entities.set(enemy.id, enemy);

    const builder = makeBuilder(enemy.id);
    executeIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id }, builder, builder.root);

    const events = collectEvents(builder.root);
    const damageEvents = events.filter((e: any) => e.type === 'ENTITY_DAMAGED');
    expect(damageEvents).toHaveLength(1);
    expect(damageEvents[0]).toMatchObject({ targetId: enemy.id, damageType: 'fire' });
    expect(enemy.hp).toBeLessThan(100);
  });

  it('does not produce damage when only poison ticks', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 100, maxHp: 100, statusEffects: [{ type: 'poisoned', duration: 2, value: 10, statModifiers: null }] });
    state.entities.set(enemy.id, enemy);

    const builder = makeBuilder(enemy.id);
    executeIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id }, builder, builder.root);

    const events = collectEvents(builder.root);
    const damageEvents = events.filter((e: any) => e.type === 'ENTITY_DAMAGED');
    expect(damageEvents).toHaveLength(0);
    expect(enemy.hp).toBe(100);
  });

  it('triggers death reaction when burning kills entity', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ id: 'enemy_1', x: 6, y: 5, hp: 5, maxHp: 100, statusEffects: [{ type: 'burning', duration: 2, value: 10, statModifiers: null }] });
    state.entities.set(enemy.id, enemy);

    const builder = makeBuilder(enemy.id);
    executeIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id }, builder, builder.root);

    const events = collectEvents(builder.root);
    expect(events.some((e: any) => e.type === 'ENTITY_DIED')).toBe(true);
    expect(enemy.isAlive).toBe(false);
  });
});
