/**
 * Unit-тесты правил кровавой лужи (blood_puddle).
 *
 * По образцу water-applies-wet.test.ts: правила реальные (CONTENT_RULES),
 * шаблон тайлового эффекта — мок с теми же ruleIds, что у настоящего
 * шаблона src/content/templates/tile-effects/blood-puddle.ts.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {runContentRuleReactions} from '../../../../src/simulation/content-rules/reaction/content-rule-reaction';
import {makeEnemy, makeGameState, makePlayer} from '../../../fixtures/gameState';
import type {GameEvent} from '../../../../src/simulation/core-types';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {LoadedContent, TileEffectTemplate} from '../../../../src/content/schemas';

function mockTileEffectTemplate(overrides: Partial<TileEffectTemplate> & { id: string }): TileEffectTemplate {
  return {
    layer: 'cover',
    duration: 4,
    renderOrder: 1,
    blocksLOS: false,
    concealsEntities: false,
    ruleIds: [],
    canHaveStatus: [],
    durationDecreasesWhenHasStatus: [],
    ...overrides,
  };
}

function createContentWithBloodPuddle(): LoadedContent {
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
      ['blood_puddle', mockTileEffectTemplate({
        id: 'blood_puddle',
        ruleIds: ['blood_puddle_applies_bleeding', 'blood_puddle_applies_bleeding_on_spawn'],
      })],
    ]),
    tileEffectStatuses: new Map(),
  };
}

describe('blood_puddle_applies_bleeding', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(createContentWithBloodPuddle());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('накладывает кровотечение на 2 хода при входе актора на клетку лужи', () => {
    const player = makePlayer({ x: 4, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });
    state.tileEffects[5]![5]!.cover = {
      type: 'blood_puddle',
      duration: 4,
      layer: 'cover',
      statusEffects: [],
      renderOrder: 1,
    };

    const event: GameEvent = {
      type: 'ENTITY_MOVED', isFieldEvent: true,
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
        type: 'bleeding',
        duration: 2,
      },
    });

    const triggeredNodes = builder.root.children.filter(
      (child) => child.event.type === 'RULE_TRIGGERED',
    );
    expect(triggeredNodes).toHaveLength(1);
    expect((triggeredNodes[0]!.event as Extract<GameEvent, { type: 'RULE_TRIGGERED' }>).ruleId)
      .toBe('blood_puddle_applies_bleeding');
  });

  it('не срабатывает, если существо зашло на клетку вне лужи', () => {
    const player = makePlayer({ x: 4, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });
    // Лужа есть, но на соседней клетке — целевая клетка (5,5) чистая.
    state.tileEffects[4]![5]!.cover = {
      type: 'blood_puddle',
      duration: 4,
      layer: 'cover',
      statusEffects: [],
      renderOrder: 1,
    };

    const event: GameEvent = {
      type: 'ENTITY_MOVED', isFieldEvent: true,
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

describe('blood_puddle_applies_bleeding_on_spawn', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(createContentWithBloodPuddle());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('накладывает кровотечение на 2 хода существу, под которым появилась лужа', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });
    state.tileEffects[5]![5]!.cover = {
      type: 'blood_puddle',
      duration: 4,
      layer: 'cover',
      statusEffects: [],
      renderOrder: 1,
    };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'blood_puddle',
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
        type: 'bleeding',
        duration: 2,
      },
    });

    const triggeredNodes = builder.root.children.filter(
      (child) => child.event.type === 'RULE_TRIGGERED',
    );
    expect(triggeredNodes).toHaveLength(1);
    expect((triggeredNodes[0]!.event as Extract<GameEvent, { type: 'RULE_TRIGGERED' }>).ruleId)
      .toBe('blood_puddle_applies_bleeding_on_spawn');
  });

  it('не трогает существо вне клетки появившейся лужи', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const enemy = makeEnemy({ id: 'enemy_aside', x: 7, y: 5 });
    const state = makeGameState({ player });
    state.entities.set(player.id, player);
    state.entities.set(enemy.id, enemy);
    state.tileEffects[5]![5]!.cover = {
      type: 'blood_puddle',
      duration: 4,
      layer: 'cover',
      statusEffects: [],
      renderOrder: 1,
    };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'blood_puddle',
      position: { x: 5, y: 5 },
      isNew: true,
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ type: 'APPLY_STATUS', entityId: player.id });
  });

  it('не срабатывает при обновлении существующей лужи (isNew = false)', () => {
    const player = makePlayer({ x: 5, y: 5 });
    const state = makeGameState({
      player,
      entities: new Map([[player.id, player]]),
    });
    state.tileEffects[5]![5]!.cover = {
      type: 'blood_puddle',
      duration: 4,
      layer: 'cover',
      statusEffects: [],
      renderOrder: 1,
    };

    const event: GameEvent = {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'blood_puddle',
      position: { x: 5, y: 5 },
      isNew: false,
    };
    const builder = new ExecutionBuilder(event);

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });
});
