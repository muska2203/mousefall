import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {executeIntents} from '../../../../src/simulation/systems/intents/execute-intent';
import {createTestTerrains, makeGameState, makePlayer, makeProp} from '../../../fixtures/gameState';
import type {EntityId, GameEvent} from '../../../../src/simulation/core-types';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import type {Entity} from '../../../../src/simulation/types';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {LoadedContent, PropTemplate, TileEffectTemplate} from '../../../../src/content/schemas';

function mockTileEffectTemplate(
  overrides: Partial<TileEffectTemplate> & { id: string },
): TileEffectTemplate {
  return {
    layer: 'cover',
    duration: 5,
    renderOrder: 1,
    blocksLOS: false,
    ruleIds: [],
    canHaveStatus: [],
    durationDecreasesWhenHasStatus: [],
    ...overrides,
  };
}

function mockPropTemplate(
  overrides: Partial<PropTemplate> & { id: string },
): PropTemplate {
  return {
    maxHp: 10,
    armor: 0,
    blocksMovement: true,
    blocksLOS: false,
    propKind: 'barrel',
    tags: [],
    canHaveStatus: [],
    ...overrides,
  };
}

function createContentWithOilBarrel(): LoadedContent {
  return {
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    statuses: new Map(),
    maps: new Map(),
    stairs: new Map(),
    doors: new Map(),
    tileEffects: new Map([
      ['oil', mockTileEffectTemplate({ id: 'oil', canHaveStatus: ['burning'] })],
    ]),
    tileEffectStatuses: new Map([
      [
        'burning',
        {
          id: 'burning',
          duration: 3,
          neverExpires: true,
          ruleIds: [],
          statusCategory: 'elemental',
          categoryPriority: 1,
          mutuallyExclusiveWith: [],
          blockedBy: [],
          renderOrder: 10,
        },
      ],
    ]),
    props: new Map([
      [
        'oil_barel',
        mockPropTemplate({
          id: 'oil_barel',
          tags: ['prop.barrel', 'contains.oil', 'flammable'],
          canHaveStatus: ['burning'],
        }),
      ],
      [
        'empty_barel',
        mockPropTemplate({
          id: 'empty_barel',
          tags: ['prop.barrel'],
        }),
      ],
    ]),
    terrains: createTestTerrains(),
  };
}

describe('prop_contains_oil_spills_on_death', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(createContentWithOilBarrel());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('разливает масло в радиусе 1 при смерти пропа с тегом contains.oil', () => {
    const player = makePlayer();
    const prop = makeProp({ id: 'prop_oil_1', x: 4, y: 5, templateId: 'oil_barel' });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[prop.id, prop], [player.id, player]]),
    });

    const event: GameEvent = {
      type: 'ENTITY_DIED',
      isFieldEvent: true,
      entityId: prop.id,
      position: { x: 4, y: 5 },
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(9);
    expect(intents.every((intent) => intent.type === 'SPAWN_TILE_EFFECT' && intent.effectType === 'oil')).toBe(true);

    const positions = intents.map((intent) =>
      intent.type === 'SPAWN_TILE_EFFECT' ? intent.position : null,
    );
    expect(positions).toContainEqual({ x: 4, y: 5 });
    expect(positions).toContainEqual({ x: 3, y: 4 });
    expect(positions).toContainEqual({ x: 5, y: 6 });

    const triggeredNodes = builder.root.children.filter(
      (child) => child.event.type === 'RULE_TRIGGERED',
    );
    expect(triggeredNodes).toHaveLength(1);
    expect((triggeredNodes[0]!.event as Extract<GameEvent, { type: 'RULE_TRIGGERED' }>).ruleId).toBe(
      'prop_contains_oil_spills_on_death',
    );
  });

  it('не срабатывает для пропа без тега contains.oil', () => {
    const player = makePlayer();
    const prop = makeProp({ id: 'prop_empty_1', x: 4, y: 5, templateId: 'empty_barel' });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[prop.id, prop], [player.id, player]]),
    });

    const event: GameEvent = {
      type: 'ENTITY_DIED',
      isFieldEvent: true,
      entityId: prop.id,
      position: { x: 4, y: 5 },
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });

  it('не выходит за границы карты', () => {
    const player = makePlayer();
    const prop = makeProp({ id: 'prop_oil_corner', x: 0, y: 0, templateId: 'oil_barel' });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[prop.id, prop], [player.id, player]]),
    });

    const event: GameEvent = {
      type: 'ENTITY_DIED',
      isFieldEvent: true,
      entityId: prop.id,
      position: { x: 0, y: 0 },
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(4);
    const positions = intents.map((intent) =>
      intent.type === 'SPAWN_TILE_EFFECT' ? `${intent.position.x},${intent.position.y}` : '',
    );
    expect(positions).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('порождает тайловый эффект масла после исполнения интентов', () => {
    const player = makePlayer();
    const prop = makeProp({ id: 'prop_oil_2', x: 4, y: 5, templateId: 'oil_barel' });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[prop.id, prop], [player.id, player]]),
    });

    const event: GameEvent = {
      type: 'ENTITY_DIED',
      isFieldEvent: true,
      entityId: prop.id,
      position: { x: 4, y: 5 },
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);
    executeIntents(state, intents, builder, builder.root);

    // Позиции в радиусе 1 от (4,5): x ∈ [3,5], y ∈ [4,6].
    expect(state.tileEffects[4]![3]!.cover).toBeDefined();
    expect(state.tileEffects[4]![4]!.cover).toBeDefined();
    expect(state.tileEffects[4]![5]!.cover).toBeDefined();
    expect(state.tileEffects[5]![3]!.cover).toBeDefined();
    expect(state.tileEffects[5]![4]!.cover).toBeDefined();
    expect(state.tileEffects[5]![5]!.cover).toBeDefined();
    expect(state.tileEffects[6]![3]!.cover).toBeDefined();
    expect(state.tileEffects[6]![4]!.cover).toBeDefined();
    expect(state.tileEffects[6]![5]!.cover).toBeDefined();
  });

  it('не разливает обычное масло, если горящая бочка с маслом умерла от огня', () => {
    const player = makePlayer();
    const prop = makeProp({
      id: 'prop_oil_burning',
      x: 4,
      y: 5,
      templateId: 'oil_barel',
      statusEffects: [{ type: 'burning', duration: 3, value: 0, statModifiers: null }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[prop.id, prop], [player.id, player]]),
    });

    const event: GameEvent = {
      type: 'ENTITY_DIED',
      isFieldEvent: true,
      entityId: prop.id,
      position: { x: 4, y: 5 },
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents.some((intent) => intent.type === 'SPAWN_TILE_EFFECT' && (intent as any).statusType === 'burning')).toBe(true);
    expect(intents.some((intent) => intent.type === 'SPAWN_TILE_EFFECT' && (intent as any).statusType === undefined)).toBe(false);
  });

  it('горящая бочка с маслом порождает горящее масло и вызывает огненный взрыв', () => {
    const player = makePlayer();
    const prop = makeProp({
      id: 'prop_oil_burning_2',
      x: 4,
      y: 5,
      templateId: 'oil_barel',
      statusEffects: [{ type: 'burning', duration: 3, value: 0, statModifiers: null }],
    });
    const state = makeGameState({
      player,
      entities: new Map<EntityId, Entity>([[prop.id, prop], [player.id, player]]),
    });

    const event: GameEvent = {
      type: 'ENTITY_DIED',
      isFieldEvent: true,
      entityId: prop.id,
      position: { x: 4, y: 5 },
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);
    executeIntents(state, intents, builder, builder.root);

    // Во всех клетках радиуса 1 должно появиться горящее масло.
    for (let y = 4; y <= 6; y++) {
      for (let x = 3; x <= 5; x++) {
        const effect = state.tileEffects[y]![x]!.cover;
        expect(effect).toBeDefined();
        expect(effect!.statusEffects.some((s) => s.type === 'burning')).toBe(true);
      }
    }

    // Должен появиться TILE_EXPLODED от мировой реакции горящего масла.
    function collectEventTypes(node: typeof builder.root): string[] {
      return [node.event.type, ...node.children.flatMap(collectEventTypes)];
    }
    const eventTypes = collectEventTypes(builder.root);
    expect(eventTypes).toContain('TILE_EXPLODED');
  });
});
