/**
 * Репродукция бага: горение на не-акторе (дверь, бочка) должно наносить урон
 * при тике статуса.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {executeIntent} from '../../../../src/simulation/systems/intents/execute-intent';
import type {EntityDamagedEvent} from '../../../../src/simulation/core-types';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import {
  initObjectContentRegistry,
  makeDoor,
  makeGameState,
  makeProp,
} from '../../../fixtures/gameState';
import {resetRegistry} from '../../../../src/content/registry';
import type {StatusTemplate} from '../../../../src/content/schemas';

function mockBurningStatus(): StatusTemplate {
  return {
    id: 'burning',
    ruleIds: [],
    statusCategory: 'elemental',
    categoryPriority: 1,
    mutuallyExclusiveWith: ['frozen'],
    blockedBy: [],
  };
}

function collectEvents(node: any): any[] {
  return [node.event, ...node.children.flatMap(collectEvents)];
}

describe('burning tick damage on non-actors', () => {
  beforeEach(() => {
    initObjectContentRegistry({
      statuses: new Map([['burning', mockBurningStatus()]]),
    });
  });

  afterEach(() => {
    resetRegistry();
  });

  it('burning damages a door on status tick', () => {
    const door = makeDoor({
      hp: 30,
      maxHp: 30,
      statusEffects: [{type: 'burning', duration: 2, value: 0, statModifiers: null}],
    });
    const state = makeGameState({entities: new Map([[door.id, door]])});

    const builder = new ExecutionBuilder({
      type: 'STATUS_TICKED',
      isFieldEvent: true,
      entityId: door.id,
      effectTypes: [],
      tags: [],
    });

    executeIntent(
      state,
      {type: 'TICK_STATUS_EFFECTS', entityId: door.id, phase: 'environment'},
      builder,
      builder.root,
    );

    const damagedEvents = collectEvents(builder.root).filter(
      (e) => e.type === 'ENTITY_DAMAGED',
    ) as EntityDamagedEvent[];

    expect(damagedEvents).toHaveLength(1);
    expect(damagedEvents[0]!.targetId).toBe(door.id);
    expect(damagedEvents[0]!.tags).toContain('damage.magical.fire');
    expect(door.hp).toBeLessThan(30);
  });

  it('burning damages a prop on status tick', () => {
    const prop = makeProp({
      hp: 10,
      maxHp: 10,
      statusEffects: [{type: 'burning', duration: 2, value: 0, statModifiers: null}],
    });
    const state = makeGameState({entities: new Map([[prop.id, prop]])});

    const builder = new ExecutionBuilder({
      type: 'STATUS_TICKED',
      isFieldEvent: true,
      entityId: prop.id,
      effectTypes: [],
      tags: [],
    });

    executeIntent(
      state,
      {type: 'TICK_STATUS_EFFECTS', entityId: prop.id, phase: 'environment'},
      builder,
      builder.root,
    );

    const damagedEvents = collectEvents(builder.root).filter(
      (e) => e.type === 'ENTITY_DAMAGED',
    ) as EntityDamagedEvent[];

    expect(damagedEvents).toHaveLength(1);
    expect(damagedEvents[0]!.targetId).toBe(prop.id);
    expect(prop.hp).toBeLessThan(10);
  });
});
