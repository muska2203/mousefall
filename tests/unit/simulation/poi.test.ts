/**
 * Тесты точки интереса (poi) и мирового слоя правил `object`
 * (фаза 4 слоистой модели клетки).
 *
 * Покрытие:
 * - `resolveInteraction`: use_poi с соседней клетки, недоступность при charges = 0.
 * - `interactAction`: validate/resolve → интент ACTIVATE_POI.
 * - `executeActivatePoiIntent`: декремент charges, событие POI_USED, отказ при 0.
 * - Слой `object`: правила из ruleIds шаблона poi собираются на клетке события
 *   (алтарь лечит игрока через altar_heals_player).
 * - Полный flow через `GameSimulation.dispatch`: активация тратит AP и заряд,
 *   игрок лечится, повторное использование недоступно.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { interactAction } from '../../../src/simulation/systems/actions/interact-action';
import { resolveInteraction } from '../../../src/simulation/systems/interactions/resolve-interaction';
import { executeActivatePoiIntent } from '../../../src/simulation/systems/intents/activate-poi-intent-executor';
import { runContentRuleReactions } from '../../../src/simulation/content-rules/reaction/content-rule-reaction';
import { GameSimulation } from '../../../src/simulation/simulation';
import { ExecutionBuilder } from '../../../src/simulation/core-types';
import type { GameEvent } from '../../../src/simulation/core-types';
import { resetRegistry } from '../../../src/content/registry';
import {
  initObjectContentRegistry,
  makeGameState,
  makePlayer,
  makePoi,
  makeStateWithPlayerAndEntity,
} from '../../fixtures/gameState';
import type { PointOfInterestEntity } from '../../../src/simulation/types';

describe('resolveInteraction — poi', () => {
  it('возвращает use_poi для точки интереса с зарядами', () => {
    const poi = makePoi({ charges: 1 });
    const state = makeGameState({ entities: new Map([[poi.id, poi]]) });

    expect(resolveInteraction(state, poi, state.player)).toEqual({
      interactionId: 'use_poi',
      usableFromAdjacent: true,
    });
  });

  it('возвращает null для точки интереса с исчерпанными зарядами', () => {
    const poi = makePoi({ charges: 0 });
    const state = makeGameState({ entities: new Map([[poi.id, poi]]) });

    expect(resolveInteraction(state, poi, state.player)).toBeNull();
  });
});

describe('interactAction — use_poi', () => {
  it('validate принимает взаимодействие с соседней клетки', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const poi = makePoi({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, poi);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: poi.id,
    });

    expect(validation.ok).toBe(true);
  });

  it('validate отклоняет взаимодействие не с соседней клетки', () => {
    const player = makePlayer({ x: 2, y: 2 });
    const poi = makePoi({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, poi);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: poi.id,
    });

    expect(validation).toEqual({ ok: false, reasonCode: 'target_not_adjacent' });
  });

  it('validate отклоняет точку интереса без зарядов', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const poi = makePoi({ x: 4, y: 5, charges: 0 });
    const state = makeStateWithPlayerAndEntity(player, poi);

    const validation = interactAction.validate(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: poi.id,
    });

    expect(validation).toEqual({ ok: false, reasonCode: 'no_interaction_available' });
  });

  it('resolve порождает интент ACTIVATE_POI', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const poi = makePoi({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, poi);

    const intents = interactAction.resolve(state, {
      type: 'INTERACT',
      entityId: player.id,
      targetId: poi.id,
    });

    expect(intents).toEqual([
      {
        type: 'ACTIVATE_POI',
        entityId: player.id,
        targetPosition: { x: 4, y: 5 },
      },
    ]);
  });
});

describe('executeActivatePoiIntent', () => {
  it('тратит заряд и порождает POI_USED', () => {
    const poi = makePoi({ x: 4, y: 5, charges: 1 });
    const state = makeGameState({ entities: new Map([[poi.id, poi]]) });

    const rootEvent = { type: 'TURN_BEGAN', isFieldEvent: false, side: 'player', round: 1, actorId: null } as GameEvent;
    const builder = new ExecutionBuilder(rootEvent);

    const node = executeActivatePoiIntent(
      state,
      { type: 'ACTIVATE_POI', entityId: 'player', targetPosition: { x: 4, y: 5 } },
      builder,
      builder.root,
    );

    expect(poi.charges).toBe(0);
    expect(node).not.toBeNull();
    expect(node!.event).toMatchObject({
      type: 'POI_USED',
      isFieldEvent: true,
      entityId: 'player',
      poiId: poi.id,
      poiType: 'altar',
      position: { x: 4, y: 5 },
      remainingCharges: 0,
    });
  });

  it('не срабатывает при исчерпанных зарядах', () => {
    const poi = makePoi({ x: 4, y: 5, charges: 0 });
    const state = makeGameState({ entities: new Map([[poi.id, poi]]) });

    const rootEvent = { type: 'TURN_BEGAN', isFieldEvent: false, side: 'player', round: 1, actorId: null } as GameEvent;
    const builder = new ExecutionBuilder(rootEvent);

    const node = executeActivatePoiIntent(
      state,
      { type: 'ACTIVATE_POI', entityId: 'player', targetPosition: { x: 4, y: 5 } },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
    expect(builder.root.children).toHaveLength(0);
  });
});

describe('мировой слой object — правила poi', () => {
  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('собирает ruleIds шаблона poi на клетке события: алтарь лечит активировавшего', () => {
    const player = makePlayer({ x: 3, y: 5, hp: 50, maxHp: 100 });
    const poi = makePoi({ x: 4, y: 5 });
    const state = makeStateWithPlayerAndEntity(player, poi);

    const event: GameEvent = {
      type: 'POI_USED', isFieldEvent: true,
      entityId: player.id,
      poiId: poi.id,
      poiType: 'altar',
      position: { x: 4, y: 5 },
      remainingCharges: 0,
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'HEAL',
      entityId: player.id,
      amount: 25,
    });

    const triggered = builder.root.children.filter((child) => child.event.type === 'RULE_TRIGGERED');
    expect(triggered).toHaveLength(1);
    expect(triggered[0]!.event).toMatchObject({
      ruleId: 'altar_heals_player',
      layer: 'world',
      ownerEntityId: poi.id,
    });
  });

  it('не собирает правила poi с другой клетки', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const poi = makePoi({ x: 7, y: 7 });
    const state = makeStateWithPlayerAndEntity(player, poi);

    const event: GameEvent = {
      type: 'POI_USED', isFieldEvent: true,
      entityId: player.id,
      poiId: 'poi_elsewhere',
      poiType: 'altar',
      position: { x: 4, y: 5 },
      remainingCharges: 0,
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });
});

describe('INTERACT с poi — полный flow (алтарь)', () => {
  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('активация тратит AP и заряд, лечит игрока; повторное использование недоступно', () => {
    const player = makePlayer({ x: 3, y: 5, hp: 50, maxHp: 100, maxAp: 2, ap: 2 });
    const poi = makePoi({ x: 4, y: 5, charges: 1 });
    const state = makeStateWithPlayerAndEntity(player, poi);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: poi.id,
    });

    expect(result.success).toBe(true);

    const updatedPoi = sim.getState().entities.get(poi.id) as PointOfInterestEntity;
    expect(updatedPoi.charges).toBe(0);
    // Алтарь лечит на 25 через правило altar_heals_player (слой object).
    expect(sim.getState().player.hp).toBe(75);
    // Взаимодействие стоит 1 AP.
    expect(sim.getState().player.ap).toBe(1);

    // Повторное использование: заряды исчерпаны, взаимодействие недоступно.
    const second = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: poi.id,
    });
    expect(second.success).toBe(false);
    expect(sim.getState().player.hp).toBe(75);
    expect(sim.getState().player.ap).toBe(1);
  });

  it('лечение не превышает maxHp', () => {
    const player = makePlayer({ x: 3, y: 5, hp: 90, maxHp: 100, maxAp: 2, ap: 2 });
    const poi = makePoi({ x: 4, y: 5, charges: 1 });
    const state = makeStateWithPlayerAndEntity(player, poi);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'INTERACT',
      entityId: player.id,
      targetId: poi.id,
    });

    expect(result.success).toBe(true);
    expect(sim.getState().player.hp).toBe(100);
  });
});
