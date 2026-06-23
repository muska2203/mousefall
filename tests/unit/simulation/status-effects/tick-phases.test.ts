import { describe, expect, it } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { tickEntityStatusEffects, tickAllStatusEffects } from '../../../../src/simulation/systems/status-effect-ticker';
import { executeTickStatusEffectsIntent } from '../../../../src/simulation/systems/intents/tick-status-effects-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import type { StatusEffect } from '../../../../src/simulation/core-types';
import { GameSimulation, defaultActionHandlerRegistry } from '../../../../src/simulation/simulation';
import type { Entity, EntityId } from '../../../../src/simulation/types';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';

function makeEffect(type: StatusEffect['type'], duration: number, tickAfter?: StatusEffect['tickAfter']): StatusEffect {
  return {
    type,
    duration,
    value: 0,
    statModifiers: null,
    ...(tickAfter !== undefined ? { tickAfter } : {}),
  };
}

describe('status effect tick phases', () => {
  it('tickEntityStatusEffects returns intent only for matching phase', () => {
    const enemy = makeEnemy({
      statusEffects: [makeEffect('burning', 3)],
    });

    expect(tickEntityStatusEffects(enemy, 'environment')).toHaveLength(1);
    expect(tickEntityStatusEffects(enemy, 'environment')[0]).toMatchObject({
      type: 'TICK_STATUS_EFFECTS',
      phase: 'environment',
    });
    expect(tickEntityStatusEffects(enemy, 'player')).toHaveLength(0);
  });

  it('tickEntityStatusEffects includes phase field in intent', () => {
    const enemy = makeEnemy({
      statusEffects: [makeEffect('burning', 3, 'player')],
    });

    const intents = tickEntityStatusEffects(enemy, 'player');
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ type: 'TICK_STATUS_EFFECTS', phase: 'player' });
  });

  it('executor ticks only effects matching intent phase', () => {
    const enemy = makeEnemy({
      hp: 100,
      maxHp: 100,
      statusEffects: [
        makeEffect('burning', 2, 'environment'),
        makeEffect('poisoned', 2, 'player'),
      ],
    });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const playerBuilder = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'player' }, playerBuilder, playerBuilder.root);

    const poisoned = enemy.statusEffects.find(e => e.type === 'poisoned');
    const burning = enemy.statusEffects.find(e => e.type === 'burning');
    expect(poisoned!.duration).toBe(1);
    expect(burning!.duration).toBe(2);

    const envBuilder = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'environment' }, envBuilder, envBuilder.root);

    expect(poisoned!.duration).toBe(1);
    expect(burning!.duration).toBe(1);
  });

  it('tickAllStatusEffects filters entities by phase', () => {
    const player = makePlayer({ statusEffects: [makeEffect('burning', 2, 'environment')] });
    const enemyWithPlayerPhase = makeEnemy({ id: 'enemy_player_phase', statusEffects: [makeEffect('poisoned', 2, 'player')] });
    const enemyWithEnvPhase = makeEnemy({ id: 'enemy_env_phase', statusEffects: [makeEffect('frozen', 2, 'environment')] });

    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemyWithPlayerPhase.id, enemyWithPlayerPhase],
        [enemyWithEnvPhase.id, enemyWithEnvPhase],
      ]),
    });

    const playerPhaseResults = tickAllStatusEffects(state, 'player');
    expect(playerPhaseResults).toHaveLength(1);
    expect(playerPhaseResults[0]!.entity.id).toBe(enemyWithPlayerPhase.id);

    const envPhaseResults = tickAllStatusEffects(state, 'environment');
    expect(envPhaseResults).toHaveLength(2);
    const envIds = envPhaseResults.map(r => r.entity.id).sort();
    expect(envIds).toEqual([player.id, enemyWithEnvPhase.id].sort());
  });

  it('burning still ticks once per round after environment turn', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({ id: 'burning_enemy', x: 6, y: 5, hp: 100, maxHp: 100, statusEffects: [makeEffect('burning', 3)] });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    initRegistry({ entities: new Map(), players: new Map(), items: new Map(), abilities: new Map(), maps: new Map(), stairs: new Map(), doors: new Map() });
    const sim = GameSimulation.loadSavedGame(state);

    sim.dispatch({ type: 'WAIT', entityId: player.id });

    const updatedEnemy = sim.getState().entities.get(enemy.id);
    expect(updatedEnemy).toBeDefined();
    expect('statusEffects' in updatedEnemy! && updatedEnemy.statusEffects.find(e => e.type === 'burning')?.duration).toBe(2);
    resetRegistry();
  });

  it('effect with tickAfter: player ticks after player turn and before environment turn', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({ id: 'player_phase_enemy', x: 6, y: 5, hp: 100, maxHp: 100, statusEffects: [makeEffect('poisoned', 3, 'player')] });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    initRegistry({ entities: new Map(), players: new Map(), items: new Map(), abilities: new Map(), maps: new Map(), stairs: new Map(), doors: new Map() });
    const sim = GameSimulation.loadSavedGame(state);

    const result = sim.dispatch({ type: 'WAIT', entityId: player.id });

    // Фаза STATUS_TICK должна быть одна (только player-фаза) и идти перед ENVIRONMENT.
    const phaseSides = result.phases.map(p => p.side);
    const statusTickIndex = phaseSides.indexOf('STATUS_TICK');
    const envIndex = phaseSides.indexOf('ENVIRONMENT');
    expect(statusTickIndex).toBeGreaterThanOrEqual(0);
    expect(statusTickIndex).toBeLessThan(envIndex);

    const updatedEnemy = sim.getState().entities.get(enemy.id);
    expect(updatedEnemy).toBeDefined();
    expect('statusEffects' in updatedEnemy! && updatedEnemy.statusEffects.find(e => e.type === 'poisoned')?.duration).toBe(2);
    resetRegistry();
  });
});
