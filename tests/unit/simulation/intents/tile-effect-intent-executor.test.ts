import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeGameState } from '../../../fixtures/gameState';
import type { GameState } from '../../../../src/simulation/types';
import {
  executeSpawnTileEffectIntent,
  executeRemoveTileEffectIntent,
  executeTickTileEffectsIntent,
} from '../../../../src/simulation/systems/intents/tile-effect-intent-executor';
import { ExecutionBuilder } from '../../../../src/simulation/core-types';
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
  };
}

function getTileEffectAt(state: GameState, x: number, y: number, effectType: string) {
  return state.tileEffects[y]![x]![effectType]!;
}

function makeBuilder(side: 'player' | 'environment' = 'player') {
  return new ExecutionBuilder({ type: 'TURN_BEGAN', side, round: 1, actorId: null });
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
        type: 'TILE_EFFECT_CHANGED',
        effectType: 'water',
        position: { x: 3, y: 3 },
        isNew: true,
      });
    });

    it('перезаписывает существующий эффект того же типа', () => {
      const state = makeGameState();
      const builder = makeBuilder();

      executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 }, duration: 5 },
        builder,
        builder.root,
      );

      const node = executeSpawnTileEffectIntent(
        state,
        { type: 'SPAWN_TILE_EFFECT', effectType: 'water', position: { x: 3, y: 3 }, duration: 2 },
        builder,
        builder.root,
      );

      expect(getTileEffectAt(state, 3, 3, 'water').duration).toBe(2);
      expect(node!.event).toMatchObject({
        type: 'TILE_EFFECT_CHANGED',
        effectType: 'water',
        isNew: false,
      });
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
  });

  describe('executeRemoveTileEffectIntent', () => {
    it('удаляет тайловый эффект и эмитит TILE_EFFECT_REMOVED', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.water = {
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

      expect(state.tileEffects[3]![3]!.water).toBeUndefined();
      expect(node).not.toBeNull();
      expect(node!.event).toMatchObject({
        type: 'TILE_EFFECT_REMOVED',
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
      state.tileEffects[3]![3]!.water = {
        type: 'water',
        duration: 3,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };
      state.tileEffects[5]![5]!.water = {
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
      state.tileEffects[3]![3]!.water = {
        type: 'water',
        duration: 1,
        layer: 'cover',
        statusEffects: [],
        renderOrder: 1,
      };
      state.tileEffects[5]![5]!.water = {
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

      expect(state.tileEffects[3]![3]!.water).toBeUndefined();
      expect(state.tileEffects[5]![5]!.water).toBeUndefined();

      const removedEvents = builder.root.children.filter(
        (child) => child.event.type === 'TILE_EFFECT_REMOVED',
      );
      expect(removedEvents).toHaveLength(2);
      expect(removedEvents[0]!.event).toMatchObject({
        type: 'TILE_EFFECT_REMOVED',
        effectType: 'water',
      });
    });

    it('не удаляет эффекты, у которых осталась положительная длительность', () => {
      const state = makeGameState();
      state.tileEffects[3]![3]!.water = {
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
      expect(builder.root.children).toHaveLength(0);
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
  });
});
