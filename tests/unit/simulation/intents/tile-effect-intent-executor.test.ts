import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createTestTerrains, makeGameState} from '../../../fixtures/gameState';
import type {GameState} from '../../../../src/simulation/types';
import {
  executeApplyTileEffectStatusIntent,
  executeRemoveTileEffectIntent,
  executeRemoveTileEffectStatusIntent,
  executeSpawnTileEffectIntent,
  executeTickTileEffectsIntent,
} from '../../../../src/simulation/systems/intents/tile-effect-intent-executor';
import {ExecutionBuilder} from '../../../../src/simulation/core-types';
import {initRegistry, resetRegistry} from '../../../../src/content/registry';
import type {LoadedContent, TileEffectStatusTemplate, TileEffectTemplate} from '../../../../src/content/schemas';

function mockTileEffectTemplate(overrides: Partial<TileEffectTemplate> & { id: string }): TileEffectTemplate {
  return {
    layer: 'cover',
    duration: 4,
    renderOrder: 1,
    blocksLOS: false,
    ruleIds: [],
    canHaveStatus: [],
    durationDecreasesWhenHasStatus: [],
    ...overrides,
  };
}

function createContentWithWater(overrides: Partial<TileEffectTemplate> = {}): LoadedContent {
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
      ['water', mockTileEffectTemplate({ id: 'water', ...overrides })],
    ]),
    tileEffectStatuses: new Map(),
    terrains: createTestTerrains(),
  };
}

function mockTileEffectStatusTemplate(
  overrides: Partial<TileEffectStatusTemplate> & { id: string },
): TileEffectStatusTemplate {
  return {
    duration: 3,
    neverExpires: false,
    ruleIds: [],
    statusCategory: 'generic',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    renderOrder: 1,
    ...overrides,
  };
}

function createContentWithOilAndStatuses(
  oilOverrides: Partial<TileEffectTemplate> = {},
  burningOverrides: Partial<TileEffectStatusTemplate> = {},
  waterOverrides: Partial<TileEffectTemplate> = {},
): LoadedContent {
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
      ['oil', mockTileEffectTemplate({ id: 'oil', canHaveStatus: ['burning'], ...oilOverrides })],
      ['water', mockTileEffectTemplate({ id: 'water', canHaveStatus: [], ...waterOverrides })],
    ]),
    tileEffectStatuses: new Map([
      ['burning', mockTileEffectStatusTemplate({ id: 'burning', statusCategory: 'elemental', renderOrder: 10, ...burningOverrides })],
      ['soaked', mockTileEffectStatusTemplate({ id: 'soaked', statusCategory: 'elemental', renderOrder: 5 })],
    ]),
    terrains: createTestTerrains(),
  };
}

function getTileEffectAt(state: GameState, x: number, y: number, effectType: string) {
  return Object.values(state.tileEffects[y]![x]!).find((effect) => effect.type === effectType)!;
}

function makeBuilder(side: 'player' | 'environment' = 'player') {
  return new ExecutionBuilder({ type: 'TURN_BEGAN', isFieldEvent: false, side, round: 1, actorId: null });
}

describe('tile-effect-intent-executor', () => {
  describe('executeSpawnTileEffectIntent', () => {
    it('создаёт тайловый эффект на указанной позиции и эмитит TILE_EFFECT_CHANGED', () => {
      const state = makeGameState();
      const builder = makeBuilder();

      const node = executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'water')).toBeDefined();
      expect(getTileEffectAt(state, 3, 3, 'water').duration).toBe(5);
      expect(getTileEffectAt(state, 3, 3, 'water').layer).toBe('cover');
      expect(getTileEffectAt(state, 3, 3, 'water').type).toBe('water');
      expect(node).not.toBeNull();
      expect(node!.event).toMatchObject({
        type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
        effectType: 'water',
        position: { x: 3, y: 3 },
        isNew: true,
      });
    });

    it('обновляет длительность существующего эффекта того же типа, сохраняя статусы', () => {
      const state = makeGameState();
      const builder = makeBuilder();

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );
      getTileEffectAt(state, 3, 3, 'water').statusEffects.push({
        type: 'test-status',
        duration: 3,
        renderOrder: 1,
      });

      const node = executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 }, duration: 2 },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'water').duration).toBe(2);
      expect(getTileEffectAt(state, 3, 3, 'water').statusEffects).toHaveLength(1);
      expect(getTileEffectAt(state, 3, 3, 'water').statusEffects[0]).toMatchObject({
        type: 'test-status',
        duration: 3,
      });
      expect(node!.event).toMatchObject({
        type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
        effectType: 'water',
        isNew: false,
      });
    });

    it('повторный спавн oil не сбрасывает статус burning', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses());
      const state = makeGameState();
      const builder = makeBuilder();

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'oil', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );
      executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 }, duration: 4 },
        builder,
        builder.root,
      );

      const node = executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'oil', position: { x: 3, y: 3 }, duration: 7 },
        builder,
        builder.root,
      );

      const effect = getTileEffectAt(state, 3, 3, 'oil');
      expect(effect.duration).toBe(7);
      expect(effect.statusEffects).toHaveLength(1);
      expect(effect.statusEffects[0]).toMatchObject({
        type: 'burning',
        duration: 4,
      });
      expect(node!.event).toMatchObject({
        type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
        effectType: 'oil',
        isNew: false,
      });

      resetRegistry();
    });

    it('использует длительность по умолчанию, если duration не указан', () => {
      const state = makeGameState();
      const builder = makeBuilder();

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'water').duration).toBe(4);
    });

    it('берёт параметры из шаблона, если intent.duration не задан', () => {
      resetRegistry();
      initRegistry(createContentWithWater({ layer: 'aboveGround', renderOrder: 5, duration: 7 }));
      const state = makeGameState();
      const builder = makeBuilder();

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'water').duration).toBe(7);
      expect(getTileEffectAt(state, 3, 3, 'water').layer).toBe('aboveGround');
      expect(getTileEffectAt(state, 3, 3, 'water').renderOrder).toBe(5);

      resetRegistry();
    });

    it('возвращает null для позиции вне карты', () => {
      const state = makeGameState();
      const builder = makeBuilder();

      const node = executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 100, y: 100 } },
        builder,
        builder.root,
      );

      expect(node).toBeNull();
    });

    it('блокирует спавн тайлового эффекта на стене', () => {
      const state = makeGameState();
      const builder = makeBuilder();

      const node = executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 0, y: 0 }, duration: 5 },
        builder,
        builder.root,
      );

      expect(node).toBeNull();
      expect(state.tileEffects[0]![0]!.cover).toBeUndefined();
    });

    it('заменяет эффект того же слоя другого типа (oil → water)', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses());
      const state = makeGameState();
      const builder = makeBuilder();

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'oil', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );
      executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 }, duration: 4 },
        builder,
        builder.root,
      );

      const node = executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );

      expect(node).not.toBeNull();
      expect(state.tileEffects[3]![3]!.cover!.type).toBe('water');
      expect(getTileEffectAt(state, 3, 3, 'oil')).toBeUndefined();
      expect(getTileEffectAt(state, 3, 3, 'water')).toBeDefined();

      resetRegistry();
    });

    it('порождает TILE_EFFECT_REMOVED перед TILE_EFFECT_CHANGED при замене эффекта того же слоя', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses());
      const state = makeGameState();
      const builder = makeBuilder();

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'oil', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );
      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );

      const events = builder.root.children.map((child) => child.event.type);
      expect(events).toEqual(['TILE_EFFECT_CHANGED', 'TILE_EFFECT_REMOVED', 'TILE_EFFECT_CHANGED']);

      const removedEvent = builder.root.children.find(
        (child) => child.event.type === 'TILE_EFFECT_REMOVED',
      );
      expect(removedEvent!.event).toMatchObject({
        type: 'TILE_EFFECT_REMOVED', isFieldEvent: true,
        effectType: 'oil',
        position: { x: 3, y: 3 },
      });

      const changedEvent = builder.root.children.find(
        (child) => child.event.type === 'TILE_EFFECT_CHANGED' && child.event.effectType === 'water',
      );
      expect(changedEvent!.event).toMatchObject({
        type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
        effectType: 'water',
        position: { x: 3, y: 3 },
        isNew: true,
      });

      resetRegistry();
    });

    it('удаляет oil и его статус burning при замене эффектом того же слоя (water)', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses());
      const state = makeGameState();
      const builder = makeBuilder();

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'oil', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );
      executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 }, duration: 4 },
        builder,
        builder.root,
      );

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );

      expect(state.tileEffects[3]![3]!.cover!.type).toBe('water');
      expect(getTileEffectAt(state, 3, 3, 'oil')).toBeUndefined();
      expect(getTileEffectAt(state, 3, 3, 'water')).toBeDefined();
      expect(getTileEffectAt(state, 3, 3, 'water').statusEffects).toHaveLength(0);

      resetRegistry();
    });

    it('эффекты разных слоёв (cover и aboveGround) сосуществуют на одной клетке', () => {
      resetRegistry();
      // water — слой aboveGround, oil остаётся слоем cover.
      initRegistry(createContentWithOilAndStatuses({}, {}, { layer: 'aboveGround' }));
      const state = makeGameState();
      const builder = makeBuilder();

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'oil', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );
      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );

      // Оба эффекта присутствуют: разные слои не вытесняют друг друга.
      expect(getTileEffectAt(state, 3, 3, 'oil')).toBeDefined();
      expect(getTileEffectAt(state, 3, 3, 'water')).toBeDefined();
      expect(state.tileEffects[3]![3]!.cover!.type).toBe('oil');
      expect(state.tileEffects[3]![3]!.aboveGround!.type).toBe('water');

      const events = builder.root.children.map((child) => child.event.type);
      expect(events).toEqual(['TILE_EFFECT_CHANGED', 'TILE_EFFECT_CHANGED']);
      expect(builder.root.children.some((child) => child.event.type === 'TILE_EFFECT_REMOVED')).toBe(false);

      // Повторный спавн oil (cover) не трогает water (aboveGround).
      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'oil', position: { x: 3, y: 3 }, duration: 7 },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'oil').duration).toBe(7);
      expect(getTileEffectAt(state, 3, 3, 'water')).toBeDefined();

      resetRegistry();
    });
  });

  describe('executeRemoveTileEffectIntent', () => {
    it('удаляет тайловый эффект и эмитит TILE_EFFECT_REMOVED', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'water',
        duration: 3,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      const node = executeRemoveTileEffectIntent(
        state,
        { type: 'REMOVE_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(state.tileEffects[3]![3]!.cover).toBeUndefined();
      expect(node).not.toBeNull();
      expect(node!.event).toMatchObject({
        type: 'TILE_EFFECT_REMOVED', isFieldEvent: true,
        effectType: 'water',
        position: { x: 3, y: 3 },
      });
    });

    it('возвращает null, если эффекта нет на тайле', () => {
      const state = makeGameState();
      const builder = makeBuilder();

      const node = executeRemoveTileEffectIntent(
        state,
        { type: 'REMOVE_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(node).toBeNull();
    });
  });

  describe('executeTickTileEffectsIntent', () => {
    it('уменьшает длительность всех тайловых эффектов на карте', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'water',
        duration: 3,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };
      state.tileEffects[5]![5]!.cover = {
        type: 'water',
        duration: 5,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'water').duration).toBe(2);
      expect(getTileEffectAt(state, 5, 5, 'water').duration).toBe(4);
    });

    it('удаляет истёкшие эффекты и эмитит TILE_EFFECT_REMOVED для каждого', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'water',
        duration: 1,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };
      state.tileEffects[5]![5]!.cover = {
        type: 'water',
        duration: 1,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      expect(state.tileEffects[3]![3]!.cover).toBeUndefined();
      expect(state.tileEffects[5]![5]!.cover).toBeUndefined();

      const removedEvents = builder.root.children.filter(
        (child) => child.event.type === 'TILE_EFFECT_REMOVED',
      );
      expect(removedEvents).toHaveLength(2);
      expect(removedEvents[0]!.event).toMatchObject({
        type: 'TILE_EFFECT_REMOVED', isFieldEvent: true,
        effectType: 'water',
      });
    });

    it('не удаляет эффекты, у которых осталась положительная длительность', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'water',
        duration: 2,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'water')).toBeDefined();
      expect(builder.root.children).toHaveLength(1);
      expect(builder.root.children[0]!.event).toMatchObject({
        type: 'TILE_EFFECT_TICKED', isFieldEvent: false,
        effectType: 'water',
        position: { x: 3, y: 3 },
      });
    });

    it('возвращает null для пустой карты', () => {
      const state = makeGameState();
      const builder = makeBuilder('environment');

      const node = executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      expect(node).toBeNull();
    });

    it('уменьшает длительность статуса burning при тике и порождает TILE_EFFECT_STATUS_TICKED', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 3, renderOrder: 10 }],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      const effect = getTileEffectAt(state, 3, 3, 'oil');
      expect(effect.duration).toBe(4);
      expect(effect.statusEffects).toHaveLength(1);
      expect(effect.statusEffects[0]!.duration).toBe(2);

      const tickedEvents = builder.root.children.filter(
        (child) => child.event.type === 'TILE_EFFECT_STATUS_TICKED',
      );
      expect(tickedEvents).toHaveLength(1);
      expect(tickedEvents[0]!.event).toMatchObject({
        type: 'TILE_EFFECT_STATUS_TICKED', isFieldEvent: false,
        effectType: 'oil',
        statusType: 'burning',
        position: { x: 3, y: 3 },
      });
    });

    it('удаляет истёкший статус burning и порождает TILE_EFFECT_STATUS_REMOVED', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 1, renderOrder: 10 }],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      const effect = getTileEffectAt(state, 3, 3, 'oil');
      expect(effect.statusEffects).toHaveLength(0);

      const events = builder.root.children.map((child) => child.event.type);
      expect(events).toEqual([
        'TILE_EFFECT_TICKED',
        'TILE_EFFECT_STATUS_TICKED',
        'TILE_EFFECT_STATUS_REMOVED',
      ]);
      const removedEvent = builder.root.children.find(
        (child) => child.event.type === 'TILE_EFFECT_STATUS_REMOVED',
      );
      expect(removedEvent!.event).toMatchObject({
        type: 'TILE_EFFECT_STATUS_REMOVED', isFieldEvent: true,
        effectType: 'oil',
        statusType: 'burning',
        position: { x: 3, y: 3 },
      });
    });

    it('удаляет истёкший эффект вместе со статусами без отдельных TILE_EFFECT_STATUS_REMOVED', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 1,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 5, renderOrder: 10 }],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      expect(state.tileEffects[3]![3]!.cover).toBeUndefined();

      const events = builder.root.children.map((child) => child.event.type);
      expect(events).toEqual(['TILE_EFFECT_REMOVED']);
      expect(builder.root.children[0]!.event).toMatchObject({
        type: 'TILE_EFFECT_REMOVED', isFieldEvent: true,
        effectType: 'oil',
        position: { x: 3, y: 3 },
      });
    });

    it('не тикает статусы эффекта, который сам истёк в этом тике', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 1,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 2, renderOrder: 10 }],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      expect(state.tileEffects[3]![3]!.cover).toBeUndefined();
      expect(builder.root.children).toHaveLength(1);
      expect(builder.root.children[0]!.event.type).toBe('TILE_EFFECT_REMOVED');
    });

    it('порождает TILE_EFFECT_TICKED для живого эффекта', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'water',
        duration: 3,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      const tickedEvents = builder.root.children.filter(
        (child) => child.event.type === 'TILE_EFFECT_TICKED',
      );
      expect(tickedEvents).toHaveLength(1);
      expect(tickedEvents[0]!.event).toMatchObject({
        type: 'TILE_EFFECT_TICKED', isFieldEvent: false,
        effectType: 'water',
        position: { x: 3, y: 3 },
      });
    });

    it('не порождает TILE_EFFECT_TICKED для истёкшего эффекта', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'water',
        duration: 1,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      const tickedEvents = builder.root.children.filter(
        (child) => child.event.type === 'TILE_EFFECT_TICKED',
      );
      expect(tickedEvents).toHaveLength(0);
    });

    it('порождает события в порядке TILE_EFFECT_TICKED → TILE_EFFECT_STATUS_TICKED → TILE_EFFECT_STATUS_REMOVED', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 1, renderOrder: 10 }],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      const events = builder.root.children.map((child) => child.event.type);
      expect(events).toEqual([
        'TILE_EFFECT_TICKED',
        'TILE_EFFECT_STATUS_TICKED',
        'TILE_EFFECT_STATUS_REMOVED',
      ]);
    });

    it('не тикает масло без горения, если шаблон требует burning', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses({ durationDecreasesWhenHasStatus: ['burning'] }));
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      const effect = getTileEffectAt(state, 3, 3, 'oil');
      expect(effect.duration).toBe(5);
      expect(builder.root.children).toHaveLength(0);

      resetRegistry();
    });

    it('тикает масло с горением и уменьшает длительность эффекта', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses(
        { durationDecreasesWhenHasStatus: ['burning'] },
        { neverExpires: true },
      ));
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 3, renderOrder: 10 }],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      const effect = getTileEffectAt(state, 3, 3, 'oil');
      expect(effect.duration).toBe(4);
      // Бесконечный статус горения не тратит свою длительность.
      expect(effect.statusEffects[0]!.duration).toBe(3);
      expect(effect.statusEffects).toHaveLength(1);
      expect(builder.root.children.map((child) => child.event.type)).toEqual([
        'TILE_EFFECT_TICKED',
        'TILE_EFFECT_STATUS_TICKED',
      ]);

      resetRegistry();
    });

    it('не удаляет бесконечный статус даже при достижении нуля длительности', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses(
        { durationDecreasesWhenHasStatus: ['burning'] },
        { neverExpires: true },
      ));
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 1, renderOrder: 10 }],
        renderOrder: 1,
      };

      const builder = makeBuilder('environment');
      executeTickTileEffectsIntent(
        state,
        { type: 'TICK_TILE_EFFECTS' },
        builder,
        builder.root,
      );

      const effect = getTileEffectAt(state, 3, 3, 'oil');
      expect(effect.statusEffects).toHaveLength(1);
      expect(effect.statusEffects[0]).toMatchObject({ type: 'burning', duration: 1 });
      expect(builder.root.children.map((child) => child.event.type)).toEqual([
        'TILE_EFFECT_TICKED',
        'TILE_EFFECT_STATUS_TICKED',
      ]);
      expect(builder.root.children.some((child) => child.event.type === 'TILE_EFFECT_STATUS_REMOVED')).toBe(false);

      resetRegistry();
    });
  });

  describe('executeApplyTileEffectStatusIntent', () => {
    beforeEach(() => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses());
    });

    afterEach(() => {
      resetRegistry();
    });

    it('накладывает burning на oil и эмитит TILE_EFFECT_STATUS_APPLIED', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      const node = executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 }, duration: 4 },
        builder,
        builder.root,
      );

      expect(node).not.toBeNull();
      expect(node!.event).toMatchObject({
        type: 'TILE_EFFECT_STATUS_APPLIED', isFieldEvent: true,
        effectType: 'oil',
        statusType: 'burning',
        position: { x: 3, y: 3 },
        duration: 4,
        sourceEntityId: null,
        isNew: true,
      });

      const effect = getTileEffectAt(state, 3, 3, 'oil');
      expect(effect.statusEffects).toHaveLength(1);
      expect(effect.statusEffects[0]).toMatchObject({
        type: 'burning',
        duration: 4,
        renderOrder: 10,
      });
    });

    it('использует длительность из шаблона, если intent.duration не указан', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'oil').statusEffects[0]!.duration).toBe(3);
    });

    it('берёт длительность из конкретного шаблона статуса', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses({}, { duration: 7 }));

      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'oil').statusEffects[0]!.duration).toBe(7);

      resetRegistry();
    });

    it('блокирует наложение, если на эффекте есть статус из blockedBy', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses({}, { blockedBy: ['soaked'] }));

      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'soaked', duration: 2, renderOrder: 5 }],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      const node = executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(node).toBeNull();
      expect(getTileEffectAt(state, 3, 3, 'oil').statusEffects).toHaveLength(1);
    });

    it('снимает статусы из mutuallyExclusiveWith и порождает TILE_EFFECT_STATUS_REMOVED', () => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses({}, { mutuallyExclusiveWith: ['soaked'] }));

      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'soaked', duration: 2, renderOrder: 5 }],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      const node = executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 }, duration: 4 },
        builder,
        builder.root,
      );

      expect(node).not.toBeNull();
      const effect = getTileEffectAt(state, 3, 3, 'oil');
      expect(effect.statusEffects).toHaveLength(1);
      expect(effect.statusEffects[0]!.type).toBe('burning');

      const removedEvents = builder.root.children.filter(
        (child) => child.event.type === 'TILE_EFFECT_STATUS_REMOVED',
      );
      expect(removedEvents).toHaveLength(1);
      expect(removedEvents[0]!.event).toMatchObject({
        type: 'TILE_EFFECT_STATUS_REMOVED', isFieldEvent: true,
        effectType: 'oil',
        statusType: 'soaked',
        position: { x: 3, y: 3 },
      });
    });

    it('обновляет длительность при повторном наложении того же статуса', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 2, renderOrder: 10 }],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      const node = executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 }, duration: 6 },
        builder,
        builder.root,
      );

      expect(node).not.toBeNull();
      expect((node!.event as any).isNew).toBe(false);
      expect(getTileEffectAt(state, 3, 3, 'oil').statusEffects).toHaveLength(1);
      expect(getTileEffectAt(state, 3, 3, 'oil').statusEffects[0]!.duration).toBe(6);
    });

    it('возвращает null при попытке наложить burning на water (не в canHaveStatus)', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'water',
        duration: 4,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      const node = executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'water', statusType: 'burning', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(node).toBeNull();
      expect(getTileEffectAt(state, 3, 3, 'water').statusEffects).toHaveLength(0);
    });

    it('возвращает null для позиции вне карты', () => {
      const state = makeGameState();
      const builder = makeBuilder();

      const node = executeApplyTileEffectStatusIntent(
        state,
        { type: 'APPLY_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 100, y: 100 } },
        builder,
        builder.root,
      );

      expect(node).toBeNull();
    });
  });

  describe('executeRemoveTileEffectStatusIntent', () => {
    beforeEach(() => {
      resetRegistry();
      initRegistry(createContentWithOilAndStatuses());
    });

    afterEach(() => {
      resetRegistry();
    });

    it('удаляет статус и эмитит TILE_EFFECT_STATUS_REMOVED', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [{ type: 'burning', duration: 4, renderOrder: 10 }],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      const node = executeRemoveTileEffectStatusIntent(
        state,
        { type: 'REMOVE_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(node).not.toBeNull();
      expect(node!.event).toMatchObject({
        type: 'TILE_EFFECT_STATUS_REMOVED', isFieldEvent: true,
        effectType: 'oil',
        statusType: 'burning',
        position: { x: 3, y: 3 },
      });
      expect(getTileEffectAt(state, 3, 3, 'oil').statusEffects).toHaveLength(0);
    });

    it('возвращает null, если статус отсутствует на эффекте', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.cover = {
        type: 'oil',
        duration: 5,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };

      const builder = makeBuilder();
      const node = executeRemoveTileEffectStatusIntent(
        state,
        { type: 'REMOVE_TILE_EFFECT_STATUS', effectType: 'oil', statusType: 'burning', position: { x: 3, y: 3 } },
        builder,
        builder.root,
      );

      expect(node).toBeNull();
    });
  });
});
