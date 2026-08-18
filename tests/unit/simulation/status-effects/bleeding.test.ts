/**
 * Тесты статуса «Кровотечение» (bleeding).
 *
 * Проверяет:
 * - тик длительности через общий TICK_STATUS_EFFECTS;
 * - правило `status_bleeding_tick_damage`: физический урон от maxHp ровно один раз
 *   на сущность (регрессионный паттерн «соседний носитель не дублирует урон»,
 *   как у status_poison_tick_damage);
 * - физическая природа тика: броня цели снижает урон.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeEnemy, makeGameState, makePlayer } from '../../../fixtures/gameState';
import { executeTickStatusEffectsIntent } from '../../../../src/simulation/systems/intents/tick-status-effects-intent-executer';
import type { StatusEffect } from '../../../../src/simulation/core-types';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import { GameSimulation } from '../../../../src/simulation/simulation';
import { advanceToPlayerTurn } from '../../../helpers/simulation';
import type { Entity, EntityId } from '../../../../src/simulation/types';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import { rebuildActiveRules } from '../../../../src/simulation/systems/rules/active-rule-lifecycle';
import type { StatusTemplate } from '../../../../src/content/schemas';

function mockStatus(id: string, ruleIds: string[] = []): StatusTemplate {
  return {
    id,
    ruleIds,
    statusCategory: 'physical',
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

describe('bleeding', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry({
      entities: new Map(),
      players: new Map(),
      items: new Map(),
      abilities: new Map(),
      maps: new Map(),
      stairs: new Map(),
      doors: new Map(),
      statuses: new Map([
        ['bleeding', mockStatus('bleeding', ['status_bleeding_tick_damage'])],
      ]),
      tileEffects: new Map(),
      tileEffectStatuses: new Map(),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('executeTickStatusEffectsIntent тикает длительность кровотечения', () => {
    const enemy = makeEnemy({
      hp: 100,
      maxHp: 100,
      statusEffects: [makeEffect('bleeding', 2)],
    });
    const state = makeGameState();
    state.entities.set(enemy.id, enemy);

    const builder = new ExecutionBuilder({ type: 'STATUS_TICKED', isFieldEvent: true, entityId: enemy.id, effectTypes: [], tags: [] });
    executeTickStatusEffectsIntent(state, { type: 'TICK_STATUS_EFFECTS', entityId: enemy.id, phase: 'enemies' }, builder, builder.root);

    const bleeding = enemy.statusEffects.find(e => e.type === 'bleeding');
    expect(bleeding!.duration).toBe(1);
  });

  it('тик кровотечения наносит урон ровно один раз, даже если соседний актор тоже кровоточит', () => {
    const player = makePlayer({
      x: 5, y: 5, hp: 100, maxHp: 100, maxAp: 1, ap: 1,
      statusEffects: [makeEffect('bleeding', 3)],
    });
    const enemy = makeEnemy({
      id: 'bleeding_enemy', x: 6, y: 5, hp: 100, maxHp: 100, maxAp: 0, ap: 0,
      statusEffects: [makeEffect('bleeding', 3)],
    });
    rebuildActiveRules(player);
    rebuildActiveRules(enemy);

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

    // Тик кровотечения: round(maxHp * 0.08) = 8 при maxHp 100, ровно один раз на сущность.
    expect(sim.getState().player.hp).toBe(92);
    const updatedEnemy = sim.getState().entities.get(enemy.id);
    expect(updatedEnemy && 'hp' in updatedEnemy ? updatedEnemy.hp : null).toBe(92);
  });

  it('броня цели снижает физический урон тика кровотечения', () => {
    const player = makePlayer({ x: 5, y: 5, hp: 100, maxHp: 100, maxAp: 1, ap: 1 });
    const enemy = makeEnemy({
      id: 'armored_bleeding_enemy', x: 6, y: 5, hp: 100, maxHp: 100, maxAp: 0, ap: 0,
      // Броня актора считается из экипировки и stat-модификаторов
      // (поле armor — derived-кэш, напрямую не используется).
      statModifiers: [{ stat: 'armor', value: 3, op: 'add', source: 'test_armor' }],
      statusEffects: [makeEffect('bleeding', 3)],
    });
    rebuildActiveRules(enemy);

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

    // round(100 * 0.08) − armor 3 = 5 физического урона.
    const updatedEnemy = sim.getState().entities.get(enemy.id);
    expect(updatedEnemy && 'hp' in updatedEnemy ? updatedEnemy.hp : null).toBe(95);
  });
});
