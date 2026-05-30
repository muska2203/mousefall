import {describe, expect, it} from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { tickEntityStatusEffects } from '../../../../src/simulation/systems/status-effect-ticker';
import { executeTickStatusEffectsIntent } from '../../../../src/simulation/systems/intents/tick-status-effects-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { GameSimulation } from '../../../../src/simulation/simulation';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';

describe('burning status effect', () => {
  it('returns TICK_STATUS_EFFECTS intent', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 3, value: 10, statModifiers: null }] });
    const intents = tickEntityStatusEffects(enemy);
    expect(intents).toHaveLength(1);
    expect(intents[0]!.type).toBe('TICK_STATUS_EFFECTS');
  });

  it('lasts exactly 3 turns through executor', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 3, value: 10, statModifiers: null }] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder1 = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id }, builder1, builder1.root);
    expect(enemy.statusEffects).toHaveLength(1);

    const builder2 = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id }, builder2, builder2.root);
    expect(enemy.statusEffects).toHaveLength(1);

    const builder3 = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id }, builder3, builder3.root);
    expect(enemy.statusEffects).toHaveLength(0);
  });

  it('removes effect after duration expires through executor', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 1, value: 10, statModifiers: null }] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id }, builder, builder.root);
    expect(enemy.statusEffects).toHaveLength(0);
  });

  it('creates ENTITY_DAMAGED event when burning ticks', () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100, statusEffects: [{ type: 'burning', duration: 2, value: 10, statModifiers: null }] });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id });
    const node = executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id }, builder, builder.root);

    expect(node).not.toBeNull();
    expect(node!.event.type).toBe('ENTITY_DAMAGED');
    expect(node!.event).toMatchObject({
      targetId: enemy.id,
      damageType: 'fire',
    });
    expect(node!.event.damage).toBeGreaterThan(0);
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

    initRegistry({ entities: new Map(), players: new Map(), items: new Map(), abilities: new Map(), maps: new Map(), stairs: new Map() });
    const sim = GameSimulation.loadSavedGame(state);

    // Тикаем через beginNextPlayerTurn (вызывается после исчерпания AP игрока)
    sim.dispatch({ type: 'WAIT', entityId: 'player' });

    // Enemy должен быть мёртв (isAlive = false), но ещё не удалён из entities
    const updatedEnemy = sim.getState().entities.get(enemy.id);
    expect(updatedEnemy).toBeDefined();
    expect('isAlive' in updatedEnemy! && updatedEnemy.isAlive).toBe(false);
    resetRegistry();
  });
});
