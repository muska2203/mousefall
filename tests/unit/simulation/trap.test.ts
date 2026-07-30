/**
 * Тесты ловушек (trap) и их жизненного цикла
 * (фаза 5 слоистой модели клетки).
 *
 * Покрытие:
 * - Слой `object`: правила из ruleIds шаблона ловушки собираются на клетке
 *   события ENTITY_MOVED независимо от hidden (скрытая ловушка срабатывает).
 * - Lifecycle-хук: срабатывание правила ловушки порождает DESTROY_OBJECT
 *   (одноразовая) или REVEAL_OBJECT (постоянная скрытая).
 * - Полный flow через `GameSimulation.dispatch`: вход на клетку с одноразовой
 *   ловушкой — урон, удаление ловушки, событие OBJECT_DESTROYED.
 * - Постоянная ловушка: раскрывается (OBJECT_REVEALED), остаётся и срабатывает
 *   повторно.
 * - Ловушка срабатывает и на врага.
 * - Исполнители DESTROY_OBJECT / REVEAL_OBJECT: отказ для несуществующих
 *   и неподходящих сущностей.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runContentRuleReactions } from '../../../src/simulation/content-rules/reaction/content-rule-reaction';
import { executeIntents } from '../../../src/simulation/systems/intents/execute-intent';
import { executeDestroyObjectIntent } from '../../../src/simulation/systems/intents/destroy-object-intent-executor';
import { executeRevealObjectIntent } from '../../../src/simulation/systems/intents/reveal-object-intent-executor';
import { GameSimulation } from '../../../src/simulation/simulation';
import { ExecutionBuilder } from '../../../src/simulation/core-types';
import type { GameEvent } from '../../../src/simulation/core-types';
import type { ExecutionNode } from '../../../src/simulation/systems/actions/types';
import { resetRegistry } from '../../../src/content/registry';
import {
  initObjectContentRegistry,
  makeEnemy,
  makeGameState,
  makePlayer,
  makePoi,
  makeStateWithPlayerAndEntity,
  makeTrap,
} from '../../fixtures/gameState';
import type { Entity, TrapEntity } from '../../../src/simulation/types';

/** Рекурсивно собирает события из дерева исполнения. */
function collectEvents(node: ExecutionNode, out: GameEvent[] = []): GameEvent[] {
  out.push(node.event);
  for (const child of node.children) {
    collectEvents(child, out);
  }
  return out;
}

/** Собирает все события из результата Simulation. */
function collectResultEvents(result: { phases: Array<{ actions: ExecutionNode[] }> }): GameEvent[] {
  const events: GameEvent[] = [];
  for (const phase of result.phases) {
    for (const action of phase.actions) {
      collectEvents(action, events);
    }
  }
  return events;
}

function makeMovedEvent(entityId: string, from: { x: number; y: number }, to: { x: number; y: number }): GameEvent {
  return {
    type: 'ENTITY_MOVED', isFieldEvent: true,
    entityId,
    from,
    to,
    movementType: 'walk',
  };
}

describe('мировой слой object — правила ловушки', () => {
  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('вход игрока на клетку со скрытой ловушкой: DAMAGE на игрока + DESTROY_OBJECT на ловушку', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const trap = makeTrap({ x: 4, y: 5, hidden: true });
    const state = makeStateWithPlayerAndEntity(player, trap);

    const event = makeMovedEvent(player.id, { x: 3, y: 5 }, { x: 4, y: 5 });
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(2);
    expect(intents[0]).toMatchObject({
      type: 'DAMAGE',
      entityId: player.id,
      damage: 10,
    });
    expect(intents[1]).toMatchObject({
      type: 'DESTROY_OBJECT',
      entityId: trap.id,
    });

    const triggered = builder.root.children.filter((child) => child.event.type === 'RULE_TRIGGERED');
    expect(triggered).toHaveLength(1);
    expect(triggered[0]!.event).toMatchObject({
      ruleId: 'spikes_deal_damage',
      layer: 'world',
      ownerEntityId: trap.id,
    });
  });

  it('скрытая ловушка срабатывает: hidden не мешает сбору правил', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const trap = makeTrap({ x: 4, y: 5, hidden: true });
    const state = makeStateWithPlayerAndEntity(player, trap);

    const event = makeMovedEvent(player.id, { x: 3, y: 5 }, { x: 4, y: 5 });
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents.some((intent) => intent.type === 'DAMAGE')).toBe(true);
  });

  it('не собирает правила ловушки с другой клетки', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const trap = makeTrap({ x: 7, y: 7 });
    const state = makeStateWithPlayerAndEntity(player, trap);

    const event = makeMovedEvent(player.id, { x: 3, y: 5 }, { x: 4, y: 5 });
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });
});

describe('ловушка — полный flow через GameSimulation.dispatch', () => {
  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('одноразовая ловушка: вход игрока — урон, ловушка удалена, OBJECT_DESTROYED', () => {
    const player = makePlayer({ x: 3, y: 5, hp: 100, maxHp: 100, maxAp: 1, ap: 1 });
    const trap = makeTrap({ x: 4, y: 5, hidden: true });
    const state = makeStateWithPlayerAndEntity(player, trap);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'MOVE',
      entityId: player.id,
      dx: 1,
      dy: 0,
    });

    expect(result.success).toBe(true);
    // Колючки наносят 10 урона через правило spikes_deal_damage (слой object).
    expect(sim.getState().player.hp).toBe(90);
    // Одноразовая ловушка уничтожена процедурно (DESTROY_OBJECT).
    expect(sim.getState().entities.has(trap.id)).toBe(false);

    const events = collectResultEvents(result);
    const destroyed = events.find((e) => e.type === 'OBJECT_DESTROYED');
    expect(destroyed).toMatchObject({
      type: 'OBJECT_DESTROYED',
      isFieldEvent: true,
      entityId: trap.id,
      objectType: 'spikes',
      position: { x: 4, y: 5 },
    });
  });

  it('постоянная ловушка: раскрывается, остаётся и срабатывает повторно', () => {
    const player = makePlayer({ x: 3, y: 5, hp: 100, maxHp: 100, maxAp: 3, ap: 3 });
    const trap = makeTrap({ x: 4, y: 5, hidden: true, templateId: 'spikes_persistent' });
    const state = makeStateWithPlayerAndEntity(player, trap);

    const sim = GameSimulation.loadSavedGame(state);

    // Первый вход: урон + раскрытие.
    const first = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
    expect(first.success).toBe(true);
    expect(sim.getState().player.hp).toBe(90);

    const revealedTrap = sim.getState().entities.get(trap.id) as TrapEntity;
    expect(revealedTrap).toBeDefined();
    expect(revealedTrap.hidden).toBe(false);

    const firstEvents = collectResultEvents(first);
    expect(firstEvents.find((e) => e.type === 'OBJECT_REVEALED')).toMatchObject({
      type: 'OBJECT_REVEALED',
      isFieldEvent: true,
      entityId: trap.id,
      objectType: 'spikes_persistent',
      position: { x: 4, y: 5 },
    });
    expect(firstEvents.some((e) => e.type === 'OBJECT_DESTROYED')).toBe(false);

    // Вышли и зашли снова: постоянная ловушка срабатывает повторно.
    expect(sim.dispatch({ type: 'MOVE', entityId: player.id, dx: -1, dy: 0 }).success).toBe(true);
    const second = sim.dispatch({ type: 'MOVE', entityId: player.id, dx: 1, dy: 0 });
    expect(second.success).toBe(true);
    expect(sim.getState().player.hp).toBe(80);
    expect(sim.getState().entities.has(trap.id)).toBe(true);
  });

  it('ловушка срабатывает на врага: урон врагу, одноразовая удаляется', () => {    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 3, y: 5, hp: 20 });
    const trap = makeTrap({ x: 4, y: 5, hidden: true });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy], [trap.id, trap]]),
    });

    const event = makeMovedEvent(enemy.id, { x: 3, y: 5 }, { x: 4, y: 5 });
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);
    expect(intents[0]).toMatchObject({
      type: 'DAMAGE',
      entityId: enemy.id,
      damage: 10,
    });

    executeIntents(state, intents, builder, builder.root);

    expect(enemy.hp).toBe(10);
    expect(state.entities.has(trap.id)).toBe(false);

    const events = collectEvents(builder.root);
    expect(events.some((e) => e.type === 'OBJECT_DESTROYED')).toBe(true);
  });

  it('автопуть через клетку со скрытой ловушкой: путь строится, срабатывание по факту входа', () => {
    const player = makePlayer({ x: 5, y: 5, hp: 100, maxHp: 100, maxAp: 2, ap: 2 });
    const trap = makeTrap({ x: 5, y: 6, hidden: true });
    const state = makeStateWithPlayerAndEntity(player, trap);
    state.explored[6]![5] = true;
    state.explored[7]![5] = true;

    const sim = GameSimulation.loadSavedGame(state);

    // Ловушка не влияет на проходимость: путь строится через её клетку.
    const path = sim.findPathForPlayer({ x: 5, y: 5 }, { x: 5, y: 7 });
    expect(path).toEqual([{ x: 5, y: 6 }, { x: 5, y: 7 }]);

    // Ход по пути: срабатывание происходит по факту входа на клетку с ловушкой.
    for (const step of path!) {
      const dx = step.x - sim.getState().player.x;
      const dy = step.y - sim.getState().player.y;
      expect(sim.dispatch({ type: 'MOVE', entityId: player.id, dx, dy }).success).toBe(true);
    }

    expect(sim.getState().player.hp).toBe(90);
    expect(sim.getState().entities.has(trap.id)).toBe(false);
    expect(sim.getState().player.x).toBe(5);
    expect(sim.getState().player.y).toBe(7);
  });
});

describe('исполнители DESTROY_OBJECT / REVEAL_OBJECT', () => {
  beforeEach(() => {
    initObjectContentRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  function makeBuilder() {
    return new ExecutionBuilder({
      type: 'TURN_BEGAN', isFieldEvent: false, side: 'player', round: 1, actorId: null,
    } as GameEvent);
  }

  it('DESTROY_OBJECT на несуществующий id возвращает null', () => {
    const state = makeGameState();
    const builder = makeBuilder();

    const node = executeDestroyObjectIntent(
      state,
      { type: 'DESTROY_OBJECT', entityId: 'missing' },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
    expect(builder.root.children).toHaveLength(0);
  });

  it('REVEAL_OBJECT на уже видимой ловушке возвращает null', () => {
    const trap = makeTrap({ hidden: false });
    const state = makeGameState({ entities: new Map([[trap.id, trap]]) });
    const builder = makeBuilder();

    const node = executeRevealObjectIntent(
      state,
      { type: 'REVEAL_OBJECT', entityId: trap.id },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });

  it('REVEAL_OBJECT на не-ловушке возвращает null', () => {
    const poi = makePoi();
    const state = makeGameState({ entities: new Map([[poi.id, poi]]) });
    const builder = makeBuilder();

    const node = executeRevealObjectIntent(
      state,
      { type: 'REVEAL_OBJECT', entityId: poi.id },
      builder,
      builder.root,
    );

    expect(node).toBeNull();
  });

  it('REVEAL_OBJECT раскрывает скрытую ловушку и порождает OBJECT_REVEALED', () => {
    const trap = makeTrap({ x: 4, y: 5, hidden: true });
    const state = makeGameState({ entities: new Map([[trap.id, trap]]) });
    const builder = makeBuilder();

    const node = executeRevealObjectIntent(
      state,
      { type: 'REVEAL_OBJECT', entityId: trap.id },
      builder,
      builder.root,
    );

    expect(trap.hidden).toBe(false);
    expect(node).not.toBeNull();
    expect(node!.event).toMatchObject({
      type: 'OBJECT_REVEALED',
      isFieldEvent: true,
      entityId: trap.id,
      objectType: 'spikes',
      position: { x: 4, y: 5 },
    });
  });
});
