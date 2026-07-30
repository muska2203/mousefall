import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {makeDoor, makeGameState, makeProp} from '../../../fixtures/gameState';
import type {GameEvent} from '../../../../src/simulation/core-types';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {DoorTemplate, LoadedContent, PropTemplate} from '../../../../src/content/schemas';

function mockDoorTemplate(overrides: Partial<DoorTemplate> & { id: string }): DoorTemplate {
  return {
    interactionKind: 'door',
    maxHp: 30,
    armor: 0,
    renderScale: 1,
    tags: [],
    canHaveStatus: [],
    ...overrides,
  };
}

function mockPropTemplate(overrides: Partial<PropTemplate> & { id: string }): PropTemplate {
  return {
    maxHp: 10,
    armor: 0,
    blocksMovement: true,
    blocksLOS: false,
    renderScale: 1,
    propKind: 'barrel',
    tags: [],
    canHaveStatus: [],
    ...overrides,
  };
}

function createContent(): LoadedContent {
  return {
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    statuses: new Map(),
    maps: new Map(),
    stairs: new Map(),
    doors: new Map([
      ['wooden_door', mockDoorTemplate({ id: 'wooden_door', tags: ['flammable'], canHaveStatus: ['burning'] })],
      ['stone_door', mockDoorTemplate({ id: 'stone_door', tags: [], canHaveStatus: [] })],
    ]),
    props: new Map([
      ['oil_barel', mockPropTemplate({ id: 'oil_barel', tags: ['flammable'], canHaveStatus: ['burning'] })],
    ]),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
  };
}

describe('fire_damage_ignites_flammable_object', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(createContent());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('поджигает горючую дверь при огненном уроне', () => {
    const door = makeDoor();
    const state = makeGameState({ entities: new Map([[door.id, door]]) });

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED', isFieldEvent: true,
      targetId: door.id,
      sourceEntityId: null,
      damage: 5,
      position: { x: door.x, y: door.y },
      tags: ['damage.magical.fire'],
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: door.id,
      status: { type: 'burning', duration: 3 },
    });
  });

  it('поджигает горючий проп при огненном уроне', () => {
    const prop = makeProp();
    const state = makeGameState({ entities: new Map([[prop.id, prop]]) });

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED', isFieldEvent: true,
      targetId: prop.id,
      sourceEntityId: null,
      damage: 5,
      position: { x: prop.x, y: prop.y },
      tags: ['damage.magical.fire'],
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: prop.id,
      status: { type: 'burning', duration: 3 },
    });
  });

  it('не поджигает негорючую дверь', () => {
    const door = makeDoor({ templateId: 'stone_door' });
    const state = makeGameState({ entities: new Map([[door.id, door]]) });

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED', isFieldEvent: true,
      targetId: door.id,
      sourceEntityId: null,
      damage: 5,
      position: { x: door.x, y: door.y },
      tags: ['damage.magical.fire'],
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });

  it('обновляет длительность горения, если объект уже горит', () => {
    const door = makeDoor({ statusEffects: [{ type: 'burning', duration: 2, value: 0, statModifiers: null }] });
    const state = makeGameState({ entities: new Map([[door.id, door]]) });

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED', isFieldEvent: true,
      targetId: door.id,
      sourceEntityId: null,
      damage: 5,
      position: { x: door.x, y: door.y },
      tags: ['damage.magical.fire'],
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: door.id,
      status: { type: 'burning', duration: 3 },
    });
  });

  it('не срабатывает без тега огненного урона', () => {
    const door = makeDoor();
    const state = makeGameState({ entities: new Map([[door.id, door]]) });

    const event: GameEvent = {
      type: 'ENTITY_DAMAGED', isFieldEvent: true,
      targetId: door.id,
      sourceEntityId: null,
      damage: 5,
      position: { x: door.x, y: door.y },
      tags: ['damage.physical.slashing'],
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });
});
