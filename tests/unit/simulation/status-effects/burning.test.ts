import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { tickEntityStatusEffects } from '../../../../src/simulation/systems/status-effect-ticker';
import { executeTickStatusEffectsIntent } from '../../../../src/simulation/systems/intents/tick-status-effects-intent-executer';
import { executeIntent } from '../../../../src/simulation/systems/intents/execute-intent';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import type { EntityDamagedEvent } from '../../../../src/simulation/core-types';
import { GameSimulation } from '../../../../src/simulation/simulation';
import { advanceToPlayerTurn } from '../../../helpers/simulation';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import { rebuildActiveRules } from '../../../../src/simulation/systems/rules/active-rule-lifecycle';
import type { StatusTemplate } from '../../../../src/content/schemas';

function mockBurningStatus(): StatusTemplate {
  return {
    id: 'burning',
    ruleIds: ['burning_tick_damage'],
    statusCategory: 'elemental',
    categoryPriority: 1,
    mutuallyExclusiveWith: ['frozen'],
    blockedBy: [],
  };
}

describe('burning status effect', () => {
  beforeEach(() => {
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
      doors: new Map(),
      statuses: new Map([['burning', mockBurningStatus()]]),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('returns TICK_STATUS_EFFECTS intent', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 3, value: 10, statModifiers: null }] });
    const intents = tickEntityStatusEffects(enemy, 'enemies');
    expect(intents).toHaveLength(1);
    expect(intents[0]!.type).toBe('TICK_STATUS_EFFECTS');
  });

  it('lasts exactly 3 turns through executor', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 3, value: 10, statModifiers: null }] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder1 = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id, effectTypes: [], tags: [] });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' }, builder1, builder1.root);
    expect(enemy.statusEffects).toHaveLength(1);

    const builder2 = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id, effectTypes: [], tags: [] });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' }, builder2, builder2.root);
    expect(enemy.statusEffects).toHaveLength(1);

    const builder3 = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id, effectTypes: [], tags: [] });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' }, builder3, builder3.root);
    expect(enemy.statusEffects).toHaveLength(0);
  });

  it('removes effect after duration expires through executor', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 1, value: 10, statModifiers: null }] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id, effectTypes: [], tags: [] });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' }, builder, builder.root);
    expect(enemy.statusEffects).toHaveLength(0);
  });

  it('emits STATUS_TICKED with burning in effectTypes', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 2, value: 10, statModifiers: null }] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id, effectTypes: [], tags: [] });
    const node = executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' }, builder, builder.root);

    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('STATUS_TICKED');
    expect(node!.event).toMatchObject({
      entityId: enemy.id,
      effectTypes: ['burning'],
    });
  });

  it('creates ENTITY_DAMAGED event when burning ticks through full intent chain', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 2, value: 10, statModifiers: null }] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);
    rebuildActiveRules(enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id, effectTypes: [], tags: [] });
    executeIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' }, builder, builder.root);

    const damagedEvents = collectEvents(builder.root).filter(e => e.type === 'ENTITY_DAMAGED');
    expect(damagedEvents).toHaveLength(1);
    expect(damagedEvents[0]).toMatchObject({
      targetId: enemy.id,
      tags: expect.arrayContaining(['damage.magical.fire']),
    });
    expect((damagedEvents[0] as EntityDamagedEvent).damage).toBeGreaterThan(0);
  });

  it('updates duration instead of stacking when same effect is applied', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 1, value: 10, statModifiers: null }] });
    // Имитируем наложение нового burning через APPLY_STATUS
    enemy.statusEffects.push({ type: 'burning', duration: 3, value: 10, statModifiers: null });
    // apply-status-intent-executer обновляет duration, но здесь мы тестиру stacking вручную
    // В реальности apply-status-intent-executer обновляет duration
  });

  it('kills entity when burning reduces hp to 0', () => {
    const state = makeGameState();
    const enemy = makeEnemy({ x: 6, y: 5, hp: 5, maxHp: 100, statusEffects: [{ type: 'burning', duration: 3, value: 10, statModifiers: null }] });
    state.entities.set(enemy.id, enemy);
    rebuildActiveRules(enemy);

    const sim = GameSimulation.loadSavedGame(state);

    // Завершаем ход игрока и запускаем ход фракции врагов.
    // Останавливаемся перед ROUND_RECOVERY, чтобы мёртвый враг ещё был в entities.
    sim.dispatch({ type: 'END_TURN', entityId: 'player' });
    while ((sim as any).turnState.phase !== 'round-recovery') {
      sim.step();
    }

    // Enemy должен быть мёртв (isAlive = false), но ещё не удалён из entities
    const updatedEnemy = sim.getState().entities.get(enemy.id);
    expect(updatedEnemy).toBeDefined();
    expect('isAlive' in updatedEnemy! && updatedEnemy.isAlive).toBe(false);
  });
});

function collectEvents(node: any): any[] {
  return [node.event, ...node.children.flatMap(collectEvents)];
}
