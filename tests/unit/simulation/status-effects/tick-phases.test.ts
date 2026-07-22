import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameState, makePlayer, makeEnemy } from '../../../fixtures/gameState';
import { tickEntityStatusEffects, tickAllStatusEffects } from '../../../../src/simulation/systems/status-effect-ticker';
import { executeTickStatusEffectsIntent } from '../../../../src/simulation/systems/intents/tick-status-effects-intent-executer';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import type { StatusEffect } from '../../../../src/simulation/core-types';
import { GameSimulation } from '../../../../src/simulation/simulation';
import { advanceToPlayerTurn } from '../../../helpers/simulation';
import type { Entity, EntityId } from '../../../../src/simulation/types';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { StatusTemplate } from '../../../../src/content/schemas';

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

function makeEffect(type: StatusEffect['type'], duration: number): StatusEffect {
  return {
    type,
    duration,
    value: 0,
    statModifiers: null,
  };
}

describe('status effect tick phases', () => {
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
        ['burning', mockStatus('burning', ['burning_tick_damage'])],
        ['poisoned', mockStatus('poisoned', ['status_poison_tick_damage'])],
      ]),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('tickEntityStatusEffects returns intent for any non-stunned status and passed side', () => {
    const enemy = makeEnemy({
      statusEffects: [makeEffect('burning', 3)],
    });

    expect(tickEntityStatusEffects(enemy, 'enemies')).toHaveLength(1);
    expect(tickEntityStatusEffects(enemy, 'enemies')[0]).toMatchObject({
      type: 'TICK_STATUS_EFFECTS',
      phase: 'enemies',
    });
    expect(tickEntityStatusEffects(enemy, 'player')).toHaveLength(1);
    expect(tickEntityStatusEffects(enemy, 'environment')).toHaveLength(1);
  });

  it('tickEntityStatusEffects returns empty for stunned-only', () => {
    const enemy = makeEnemy({
      statusEffects: [makeEffect('stunned', 1)],
    });

    expect(tickEntityStatusEffects(enemy, 'enemies')).toHaveLength(0);
  });

  it('executeTickStatusEffectsIntent ticks all non-stunned effects', () => {
    const enemy = makeEnemy({
      hp: 100,
      maxHp: 100,
      statusEffects: [
        makeEffect('burning', 2),
        makeEffect('poisoned', 2),
      ],
    });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_TICKED', entityId: enemy.id, effectTypes: [], tags: [] });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' }, builder, builder.root);

    const poisoned = enemy.statusEffects.find(e => e.type === 'poisoned');
    const burning = enemy.statusEffects.find(e => e.type === 'burning');
    expect(poisoned!.duration).toBe(1);
    expect(burning!.duration).toBe(1);
  });

  it('tickAllStatusEffects returns all entities with tickable effects regardless of phase', () => {
    const player = makePlayer({ statusEffects: [makeEffect('burning', 2)] });
    const enemyWithPoison = makeEnemy({ id: 'enemy_poison', statusEffects: [makeEffect('poisoned', 2)] });
    const enemyWithStun = makeEnemy({ id: 'enemy_stun', statusEffects: [makeEffect('stunned', 2)] });

    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemyWithPoison.id, enemyWithPoison],
        [enemyWithStun.id, enemyWithStun],
      ]),
    });

    const results = tickAllStatusEffects(state, 'enemies');
    expect(results).toHaveLength(2);
    const ids = results.map(r => r.entity.id).sort();
    expect(ids).toEqual([player.id, enemyWithPoison.id].sort());
  });

  it('burning ticks once per round in FACTION_SETUP enemies', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({ id: 'burning_enemy', x: 6, y: 5, hp: 100, maxHp: 100, statusEffects: [makeEffect('burning', 3)] });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = GameSimulation.loadSavedGame(state);

    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(sim);

    const updatedEnemy = sim.getState().entities.get(enemy.id);
    expect(updatedEnemy).toBeDefined();
    expect('statusEffects' in updatedEnemy! && updatedEnemy.statusEffects.find(e => e.type === 'burning')?.duration).toBe(2);
  });

  it('poisoned ticks in FACTION_SETUP player of next round', () => {
    const player = makePlayer({ x: 5, y: 5, maxAp: 1, ap: 1, statusEffects: [makeEffect('poisoned', 3)] });
    const enemy = makeEnemy({ id: 'poison_enemy', x: 6, y: 5, hp: 100, maxHp: 100 });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([
        [player.id, player],
        [enemy.id, enemy],
      ]),
    });

    const sim = GameSimulation.loadSavedGame(state);

    sim.dispatch({ type: 'END_TURN', entityId: player.id });
    advanceToPlayerTurn(sim);

    const updatedPlayer = sim.getState().player;
    expect(updatedPlayer.statusEffects.find(e => e.type === 'poisoned')?.duration).toBe(2);
  });
});
