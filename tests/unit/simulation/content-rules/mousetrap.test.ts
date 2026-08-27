/**
 * Тесты ловушки «Мышеловка» (mousetrap, концепт этажа 1, §4.7).
 *
 * Проверяет:
 * - три эффекта одним срабатыванием: урон 8 piercing + кровотечение (3 хода)
 *   + обездвиживание (2 хода);
 * - оба статуса проходят одним батчем (категории wound/control не конфликтуют
 *   в resolveStatusBatch);
 * - oneShot-ловушка уничтожается после срабатывания (DESTROY_OBJECT);
 * - срабатывание на враге;
 * - полный flow через GameSimulation.dispatch.
 *
 * Числа черновые (балансный проход roadMap 1.4) — тесты фиксируют текущие
 * значения правил, а не балансное решение.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runContentRuleReactions } from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import { executeIntents } from '../../../../src/simulation/systems/intents/execute-intent';
import { GameSimulation } from '../../../../src/simulation/simulation';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import type { GameEvent } from '../../../../src/simulation/core-types';
import type { ExecutionNode } from '../../../../src/simulation/systems/actions/types';
import { resetRegistry } from '../../../../src/content/registry';
import {
  initObjectContentRegistry,
  makeEnemy,
  makeGameState,
  makePlayer,
  makeStateWithPlayerAndEntity,
  makeTrap,
} from '../../../fixtures/gameState';
import type { Entity } from '../../../../src/simulation/types';
import type { StatusTemplate, TrapTemplate } from '../../../../src/content/schemas';

/** Мок шаблона мышеловки: ссылается на реальные правила CONTENT_RULES. */
function mockMousetrapTemplate(): TrapTemplate {
  return {
    id: 'mousetrap',
    ruleIds: ['mousetrap_deal_damage', 'mousetrap_apply_bleeding', 'mousetrap_apply_rooted'],
    oneShot: true,
    initiallyHidden: true,
    tags: [],
  };
}

/** Моки шаблонов статусов с реальными категориями контента (wound/control). */
function mockStatus(id: string, statusCategory: string): StatusTemplate {
  return {
    id,
    ruleIds: [],
    statusCategory,
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    statModifiers: [],
  } as StatusTemplate;
}

function initMousetrapRegistry(): void {
  initObjectContentRegistry({
    traps: new Map([['mousetrap', mockMousetrapTemplate()]]),
    statuses: new Map([
      ['bleeding', mockStatus('bleeding', 'wound')],
      ['rooted', mockStatus('rooted', 'control')],
    ]),
  });
}

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

describe('мышеловка — правила слоя object', () => {
  beforeEach(() => {
    initMousetrapRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('вход на клетку со скрытой мышеловкой: DAMAGE + APPLY_STATUS bleeding/rooted + DESTROY_OBJECT', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const trap = makeTrap({ x: 4, y: 5, hidden: true, templateId: 'mousetrap', displayName: 'Мышеловка' });
    const state = makeStateWithPlayerAndEntity(player, trap);

    const event = makeMovedEvent(player.id, { x: 3, y: 5 }, { x: 4, y: 5 });
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    // Три правила + по DESTROY_OBJECT от lifecycle-хука на каждое сработавшее
    // правило oneShot-ловушки. Дубликаты безвредны: лишние исполнители
    // DESTROY_OBJECT возвращают null (см. полный flow ниже — OBJECT_DESTROYED один).
    expect(intents).toHaveLength(6);
    expect(intents).toContainEqual(expect.objectContaining({
      type: 'DAMAGE',
      entityId: player.id,
      damage: 8,
      tags: ['damage.physical.piercing'],
    }));
    expect(intents).toContainEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      entityId: player.id,
      status: expect.objectContaining({ type: 'bleeding', duration: 3 }),
    }));
    expect(intents).toContainEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      entityId: player.id,
      status: expect.objectContaining({ type: 'rooted', duration: 2 }),
    }));
    expect(intents).toContainEqual(expect.objectContaining({
      type: 'DESTROY_OBJECT',
      entityId: trap.id,
    }));
    expect(intents.filter((intent) => intent.type === 'DESTROY_OBJECT')).toHaveLength(3);

    const triggered = builder.root.children.filter((child) => child.event.type === 'RULE_TRIGGERED');
    expect(triggered.map((child) => (child.event as { ruleId: string }).ruleId).sort()).toEqual([
      'mousetrap_apply_bleeding',
      'mousetrap_apply_rooted',
      'mousetrap_deal_damage',
    ]);
  });

  it('не собирает правила мышеловки с другой клетки', () => {
    const player = makePlayer({ x: 3, y: 5 });
    const trap = makeTrap({ x: 7, y: 7, templateId: 'mousetrap' });
    const state = makeStateWithPlayerAndEntity(player, trap);

    const event = makeMovedEvent(player.id, { x: 3, y: 5 }, { x: 4, y: 5 });
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });
});

describe('мышеловка — полный flow через GameSimulation.dispatch', () => {
  beforeEach(() => {
    initMousetrapRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('вход игрока: урон 8, bleeding (3) и rooted (2) одним батчем, ловушка удалена', () => {
    const player = makePlayer({ x: 3, y: 5, hp: 100, maxHp: 100, maxAp: 1, ap: 1 });
    const trap = makeTrap({ x: 4, y: 5, hidden: true, templateId: 'mousetrap', displayName: 'Мышеловка' });
    const state = makeStateWithPlayerAndEntity(player, trap);

    const sim = GameSimulation.loadSavedGame(state);
    const result = sim.dispatch({
      type: 'MOVE',
      entityId: player.id,
      dx: 1,
      dy: 0,
    });

    expect(result.success).toBe(true);
    expect(sim.getState().player.hp).toBe(92);

    const bleeding = sim.getState().player.statusEffects.find((effect) => effect.type === 'bleeding');
    const rooted = sim.getState().player.statusEffects.find((effect) => effect.type === 'rooted');
    expect(bleeding).toMatchObject({ type: 'bleeding', duration: 3 });
    expect(rooted).toMatchObject({ type: 'rooted', duration: 2 });

    // Одноразовая ловушка уничтожена процедурно (DESTROY_OBJECT).
    expect(sim.getState().entities.has(trap.id)).toBe(false);

    const events = collectResultEvents(result);
    // Дубликаты DESTROY_OBJECT lifecycle-хука (по одному на правило) исполняются
    // в null после первого — событие OBJECT_DESTROYED ровно одно.
    expect(events.filter((e) => e.type === 'OBJECT_DESTROYED')).toHaveLength(1);
    expect(events.find((e) => e.type === 'OBJECT_DESTROYED')).toMatchObject({
      type: 'OBJECT_DESTROYED',
      isFieldEvent: true,
      entityId: trap.id,
      objectType: 'mousetrap',
      position: { x: 4, y: 5 },
    });
  });

  it('мышеловка срабатывает на врага: урон и оба статуса врагу, ловушка удаляется', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ x: 3, y: 5, hp: 20 });
    const trap = makeTrap({ x: 4, y: 5, hidden: true, templateId: 'mousetrap', displayName: 'Мышеловка' });
    const state = makeGameState({
      player,
      entities: new Map<string, Entity>([[player.id, player], [enemy.id, enemy], [trap.id, trap]]),
    });

    const event = makeMovedEvent(enemy.id, { x: 3, y: 5 }, { x: 4, y: 5 });
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);
    expect(intents).toContainEqual(expect.objectContaining({
      type: 'DAMAGE',
      entityId: enemy.id,
      damage: 8,
    }));
    expect(intents).toContainEqual(expect.objectContaining({
      type: 'APPLY_STATUS',
      entityId: enemy.id,
      status: expect.objectContaining({ type: 'rooted', duration: 2 }),
    }));

    executeIntents(state, intents, builder, builder.root);

    expect(enemy.hp).toBe(12);
    expect(enemy.statusEffects.some((effect) => effect.type === 'bleeding')).toBe(true);
    expect(enemy.statusEffects.some((effect) => effect.type === 'rooted')).toBe(true);
    expect(state.entities.has(trap.id)).toBe(false);

    const events = collectEvents(builder.root);
    expect(events.some((e) => e.type === 'OBJECT_DESTROYED')).toBe(true);
  });
});
