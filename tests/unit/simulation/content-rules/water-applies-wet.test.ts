import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runContentRuleReactions } from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import { makePlayer, makeGameState } from '../../../fixtures/gameState';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
import type { GameEvent } from '../../../../src/simulation/core-types';
import { initRegistry, resetRegistry } from '../../../../src/content/registry';
import type { LoadedContent, TileEffectTemplate } from '../../../../src/content/schemas';

function mockTileEffectTemplate(overrides: Partial<TileEffectTemplate> & { id: string }): TileEffectTemplate {
  return {
    layer: 'cover',
    duration: 4,
    renderOrder: 1,
    ruleIds: [],
    blockedByTileEffects: [],
    mutuallyExclusiveWithTileEffects: [],
    canHaveStatus: [],
    durationDecreasesWhenHasStatus: [],
    ...overrides,
  };
}

function createContentWithWater(): LoadedContent {
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
      ['water', mockTileEffectTemplate({ id: 'water', ruleIds: ['water_applies_wet', 'water_applies_wet_on_spawn'] })],
    ]),
    tileEffectStatuses: new Map(),
  };
}

describe('water_applies_wet', () => {
  beforeEach(() => {
    initRegistry(createContentWithWater());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('накладывает статус wet при входе актора на тайл с водой', () => {
    const player = makePlayer({ x: 4, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });
    state.tileEffects[5]![5]!.water = {
      type: 'water',
      duration: 3,
      layer: 'cover',
      statusEffects: [],
      renderOrder: 1,
    };

    const event: GameEvent = {
      type: 'ENTITY_MOVED',
      entityId: player.id,
      from: { x: 4, y: 5 },
      to: { x: 5, y: 5 },
      movementType: 'walk',
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: player.id,
      status: {
        type: 'wet',
        duration: 3,
      },
    });

    const triggeredNodes = builder.root.children.filter(
      (child) => child.event.type === 'RULE_TRIGGERED',
    );
    expect(triggeredNodes).toHaveLength(1);
    expect((triggeredNodes[0]!.event as Extract<GameEvent, { type: 'RULE_TRIGGERED' }>).ruleId).toBe('water_applies_wet');
  });

  it('не срабатывает, если на тайле нет воды', () => {
    const player = makePlayer({ x: 4, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });

    const event: GameEvent = {
      type: 'ENTITY_MOVED',
      entityId: player.id,
      from: { x: 4, y: 5 },
      to: { x: 5, y: 5 },
      movementType: 'walk',
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });
});

describe('water_applies_wet_on_spawn', () => {
  beforeEach(() => {
    initRegistry(createContentWithWater());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('накладывает статус wet на актора, стоящего на тайле, когда на него накладывается вода', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });
    state.tileEffects[5]![5]!.water = {
      type: 'water',
      duration: 3,
      layer: 'cover',
      statusEffects: [],
      renderOrder: 1,
    };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED',
      effectType: 'water',
      position: { x: 5, y: 5 },
      isNew: true,
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPLY_STATUS',
      entityId: player.id,
      status: {
        type: 'wet',
        duration: 3,
      },
    });

    const triggeredNodes = builder.root.children.filter(
      (child) => child.event.type === 'RULE_TRIGGERED',
    );
    expect(triggeredNodes).toHaveLength(1);
    expect((triggeredNodes[0]!.event as Extract<GameEvent, { type: 'RULE_TRIGGERED' }>).ruleId).toBe('water_applies_wet_on_spawn');
  });

  it('не срабатывает при обновлении существующей воды', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });
    state.tileEffects[5]![5]!.water = {
      type: 'water',
      duration: 3,
      layer: 'cover',
      statusEffects: [],
      renderOrder: 1,
    };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED',
      effectType: 'water',
      position: { x: 5, y: 5 },
      isNew: false,
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });
});
