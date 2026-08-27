/**
 * Юнит-тесты мировых правил разлива муки при смерти мешка:
 * - prop_contains_flour_spills_on_death: смерть пропа с тегом contains.flour
 *   (без горения) разливает flour_cloud в радиусе 1 включая центр;
 * - flammable_flour_bag_explodes_on_fire_death: горящий мешок порождает
 *   горящие облака (burning, duration 3), каждое из которых детонирует
 *   обобщённой реакцией tile-effect-explosion-reaction и расходуется.
 *
 * По образцу prop-contains-oil-spills-on-death.test.ts.
 */

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
    layer: 'aboveGround',
    duration: 4,
    renderOrder: 1,
    blocksLOS: true,
    concealsEntities: true,
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
    maxHp: 3,
    armor: 0,
    blocksMovement: true,
    blocksLOS: false,
    propKind: 'sack',
    tags: [],
    canHaveStatus: [],
    ...overrides,
  };
}

function createContentWithFlourBag(): LoadedContent {
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
      ['flour_cloud', mockTileEffectTemplate({
        id: 'flour_cloud',
        canHaveStatus: ['burning'],
        explosion: {
          triggerStatus: 'burning',
          damage: 5,
          radius: 1,
          consumesEffect: true,
          tags: ['damage.magical.fire'],
        },
      })],
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
        'flour_bag',
        mockPropTemplate({
          id: 'flour_bag',
          tags: ['prop.sack', 'contains.flour', 'flammable'],
          canHaveStatus: ['burning'],
        }),
      ],
      [
        'empty_bag',
        mockPropTemplate({
          id: 'empty_bag',
          tags: ['prop.sack'],
        }),
      ],
    ]),
    terrains: createTestTerrains(),
  };
}

/** Собирает состояние с одним пропом и событием его гибели. */
function makeDeathSetup(propOverrides: Parameters<typeof makeProp>[0]) {
  const player = makePlayer();
  const prop = makeProp(propOverrides);
  const state = makeGameState({
    player,
    entities: new Map<EntityId, Entity>([[prop.id, prop], [player.id, player]]),
  });
  const event: GameEvent = {
    type: 'ENTITY_DIED',
    isFieldEvent: true,
    entityId: prop.id,
    position: { x: prop.x, y: prop.y },
    sourceEntityId: null,
  };
  const builder = new ExecutionBuilder(event);
  return { state, event, builder };
}

function collectEventTypes(node: ExecutionBuilder['root']): string[] {
  return [node.event.type, ...node.children.flatMap(collectEventTypes)];
}

describe('prop_contains_flour_spills_on_death', () => {
  beforeEach(() => {
    resetRegistry();
    initRegistry(createContentWithFlourBag());
  });

  afterEach(() => {
    resetRegistry();
  });

  it('разливает муку в радиусе 1 при смерти пропа с тегом contains.flour', () => {
    const { state, event, builder } = makeDeathSetup({ id: 'prop_flour_1', x: 4, y: 5, templateId: 'flour_bag' });

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(9);
    expect(intents.every((intent) => intent.type === 'SPAWN_TILE_EFFECT' && intent.effectType === 'flour_cloud')).toBe(true);

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
      'prop_contains_flour_spills_on_death',
    );
  });

  it('не срабатывает для пропа без тега contains.flour', () => {
    const { state, event, builder } = makeDeathSetup({ id: 'prop_empty_1', x: 4, y: 5, templateId: 'empty_bag' });

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(0);
  });

  it('не выходит за границы карты', () => {
    const { state, event, builder } = makeDeathSetup({ id: 'prop_flour_corner', x: 0, y: 0, templateId: 'flour_bag' });

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    expect(intents).toHaveLength(4);
    const positions = intents.map((intent) =>
      intent.type === 'SPAWN_TILE_EFFECT' ? `${intent.position.x},${intent.position.y}` : '',
    );
    expect(positions).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('порождает облака муки на слое aboveGround после исполнения интентов', () => {
    const { state, event, builder } = makeDeathSetup({ id: 'prop_flour_2', x: 4, y: 5, templateId: 'flour_bag' });

    const intents = runContentRuleReactions(state, event, builder, builder.root);
    executeIntents(state, intents, builder, builder.root);

    // Позиции в радиусе 1 от (4,5): x ∈ [3,5], y ∈ [4,6].
    for (let y = 4; y <= 6; y++) {
      for (let x = 3; x <= 5; x++) {
        const effect = state.tileEffects[y]![x]!.aboveGround;
        expect(effect, `облако муки на (${x}, ${y}) должно появиться`).toBeDefined();
        expect(effect!.type).toBe('flour_cloud');
        // Негорящий мешок — облака без статуса burning.
        expect(effect!.statusEffects.some((s) => s.type === 'burning')).toBe(false);
      }
    }
  });

  it('горящий мешок порождает облака со статусом burning (duration 3), обычных — нет', () => {
    const { state, event, builder } = makeDeathSetup({
      id: 'prop_flour_burning',
      x: 4,
      y: 5,
      templateId: 'flour_bag',
      statusEffects: [{ type: 'burning', duration: 3, value: 0, statModifiers: null }],
    });

    const intents = runContentRuleReactions(state, event, builder, builder.root);

    const spawnIntents = intents.filter((intent) => intent.type === 'SPAWN_TILE_EFFECT');
    expect(spawnIntents).toHaveLength(9);
    expect(spawnIntents.every((intent) => (intent as any).statusType === 'burning')).toBe(true);
    expect(spawnIntents.every((intent) => (intent as any).statusDuration === 3)).toBe(true);

    const triggeredRuleIds = builder.root.children
      .filter((child) => child.event.type === 'RULE_TRIGGERED')
      .map((child) => (child.event as Extract<GameEvent, { type: 'RULE_TRIGGERED' }>).ruleId);
    expect(triggeredRuleIds).toContain('flammable_flour_bag_explodes_on_fire_death');
    expect(triggeredRuleIds).not.toContain('prop_contains_flour_spills_on_death');
  });

  it('горящие облака муки детонируют и расходуются после исполнения интентов', () => {
    const { state, event, builder } = makeDeathSetup({
      id: 'prop_flour_burning_2',
      x: 4,
      y: 5,
      templateId: 'flour_bag',
      statusEffects: [{ type: 'burning', duration: 3, value: 0, statModifiers: null }],
    });

    const intents = runContentRuleReactions(state, event, builder, builder.root);
    executeIntents(state, intents, builder, builder.root);

    // Каждое облако получило burning при спавне → взрыв (TILE_EXPLODED).
    expect(collectEventTypes(builder.root)).toContain('TILE_EXPLODED');

    // explosion.consumesEffect — облака расходованы взрывом.
    for (let y = 4; y <= 6; y++) {
      for (let x = 3; x <= 5; x++) {
        expect(
          state.tileEffects[y]![x]!.aboveGround,
          `облако муки на (${x}, ${y}) должно быть расходовано взрывом`,
        ).toBeUndefined();
      }
    }
  });
});
