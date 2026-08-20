/**
 * Юнит-тесты air-эффектов (слой aboveGround) и блокировки обзора.
 *
 * Проверяет:
 * 1. blocksLOS: эффект с blocksLOS (дым) блокирует обзор, вода — нет.
 * 2. FOV: дым скрывает клетки за собой; после удаления обзор восстанавливается.
 * 3. tileEffectFovReaction: появление/исчезновение блокирующего эффекта
 *    порождает UPDATE_FOG; продление длительности и неблокирующие эффекты — нет.
 * 4. Слои: cover и aboveGround сосуществуют; другой air-эффект заменяет дым
 *    с порядком событий REMOVED → CHANGED; повторный спавн продлевает длительность.
 */

import {beforeEach, describe, expect, it} from 'vitest';
import {blocksLOS} from '../../../src/simulation/state';
import {computeFOV} from '../../../src/simulation/systems/fov';
import {tileEffectFovReaction} from '../../../src/simulation/systems/world-reactions/tile-effect-fov-reaction';
import {executeSpawnTileEffectIntent} from '../../../src/simulation/systems/intents/tile-effect-intent-executor';
import {ExecutionBuilder} from '../../../src/simulation/core-types';
import {initObjectContentRegistry, makeGameState} from '../../fixtures/gameState';
import type {TileEffectTemplate} from '../../../src/content/schemas';
import type {GameEvent, GameState} from '../../../src/simulation/types';
import type {TileEffectLayer} from '../../../src/simulation/core-types';

function mockTileEffectTemplate(overrides: Partial<TileEffectTemplate> & {id: string}): TileEffectTemplate {
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

function initSmokeRegistry(): void {
  initObjectContentRegistry({
    tileEffects: new Map([
      ['smoke', mockTileEffectTemplate({id: 'smoke', layer: 'aboveGround', blocksLOS: true})],
      ['fumes', mockTileEffectTemplate({id: 'fumes', layer: 'aboveGround'})],
      ['water', mockTileEffectTemplate({id: 'water'})],
    ]),
  });
}

function putEffect(
  state: GameState,
  x: number,
  y: number,
  type: string,
  layer: TileEffectLayer,
): void {
  state.tileEffects[y]![x]![layer] = {type, duration: 3, layer, statusEffects: [], renderOrder: 1};
}

function makeBuilder() {
  return new ExecutionBuilder({type: 'TURN_BEGAN', isFieldEvent: false, side: 'player', round: 1, actorId: null});
}

function spawnEffect(state: GameState, effectType: string, x: number, y: number, builder = makeBuilder()) {
  const node = executeSpawnTileEffectIntent(
    state,
    {type: 'SPAWN_TILE_EFFECT', effectType, position: {x, y}},
    builder,
    builder.root,
  );
  return {node, builder};
}

beforeEach(() => {
  initSmokeRegistry();
});

describe('blocksLOS с тайловыми эффектами', () => {
  it('эффект с blocksLOS (дым) блокирует обзор клетки', () => {
    const state = makeGameState();
    putEffect(state, 4, 4, 'smoke', 'aboveGround');

    expect(blocksLOS(state, 4, 4)).toBe(true);
  });

  it('эффект без blocksLOS (вода) не блокирует обзор', () => {
    const state = makeGameState();
    putEffect(state, 4, 4, 'water', 'cover');

    expect(blocksLOS(state, 4, 4)).toBe(false);
  });

  it('клетка без эффектов не блокирует обзор', () => {
    const state = makeGameState();

    expect(blocksLOS(state, 4, 4)).toBe(false);
  });
});

describe('FOV с дымом', () => {
  it('дым скрывает клетки за собой, вода — нет', () => {
    const state = makeGameState();
    const fovKeys = (s: GameState) => new Set(computeFOV(s, 2, 5, 8).map((p) => `${p.x},${p.y}`));

    // Контроль: без эффектов весь коридор виден.
    const baseline = fovKeys(state);
    expect(baseline.has('5,5')).toBe(true);
    expect(baseline.has('6,5')).toBe(true);

    putEffect(state, 4, 5, 'smoke', 'aboveGround');
    const withSmoke = fovKeys(state);
    expect(withSmoke.has('4,5')).toBe(true); // сам дым виден, как стена
    expect(withSmoke.has('5,5')).toBe(false);
    expect(withSmoke.has('6,5')).toBe(false);

    putEffect(state, 4, 5, 'water', 'cover'); // дым остаётся, вода добавляется на cover
    putEffect(state, 3, 5, 'water', 'cover');
    const withWater = fovKeys(state);
    expect(withWater.has('3,5')).toBe(true); // вода обзор не блокирует
  });

  it('после удаления дыма обзор восстанавливается', () => {
    const state = makeGameState();
    const fovKeys = (s: GameState) => new Set(computeFOV(s, 2, 5, 8).map((p) => `${p.x},${p.y}`));

    putEffect(state, 4, 5, 'smoke', 'aboveGround');
    expect(fovKeys(state).has('6,5')).toBe(false);

    delete state.tileEffects[5]![4]!.aboveGround;
    expect(fovKeys(state).has('6,5')).toBe(true);
  });
});

describe('tileEffectFovReaction', () => {
  const callReaction = (state: GameState, event: GameEvent) =>
    tileEffectFovReaction(state, event, null as never, null as never);

  it('появление эффекта с blocksLOS порождает UPDATE_FOG', () => {
    const state = makeGameState();
    const intents = callReaction(state, {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'smoke', position: {x: 3, y: 3}, isNew: true,
    });

    expect(intents).toEqual([{type: 'UPDATE_FOG'}]);
  });

  it('исчезновение эффекта с blocksLOS порождает UPDATE_FOG', () => {
    const state = makeGameState();
    const intents = callReaction(state, {
      type: 'TILE_EFFECT_REMOVED', isFieldEvent: true,
      effectType: 'smoke', position: {x: 3, y: 3},
    });

    expect(intents).toEqual([{type: 'UPDATE_FOG'}]);
  });

  it('продление длительности существующего эффекта не порождает UPDATE_FOG', () => {
    const state = makeGameState();
    const intents = callReaction(state, {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'smoke', position: {x: 3, y: 3}, isNew: false,
    });

    expect(intents).toEqual([]);
  });

  it('эффект без blocksLOS не порождает UPDATE_FOG', () => {
    const state = makeGameState();
    const changed = callReaction(state, {
      type: 'TILE_EFFECT_CHANGED', isFieldEvent: true,
      effectType: 'water', position: {x: 3, y: 3}, isNew: true,
    });
    const removed = callReaction(state, {
      type: 'TILE_EFFECT_REMOVED', isFieldEvent: true,
      effectType: 'water', position: {x: 3, y: 3},
    });

    expect(changed).toEqual([]);
    expect(removed).toEqual([]);
  });
});

describe('слой aboveGround: спавн и замена', () => {
  it('дым (aboveGround) сосуществует с водой (cover) на одной клетке', () => {
    const state = makeGameState();
    spawnEffect(state, 'water', 3, 3);
    spawnEffect(state, 'smoke', 3, 3);

    const cell = state.tileEffects[3]![3]!;
    expect(cell.cover?.type).toBe('water');
    expect(cell.aboveGround?.type).toBe('smoke');
  });

  it('другой air-эффект заменяет дым с порядком событий REMOVED → CHANGED', () => {
    const state = makeGameState();
    spawnEffect(state, 'smoke', 3, 3);
    const {builder} = spawnEffect(state, 'fumes', 3, 3);

    const cell = state.tileEffects[3]![3]!;
    expect(cell.aboveGround?.type).toBe('fumes');

    const eventTypes = builder.root.children.map((child) => `${child.event.type}:${(child.event as {effectType?: string}).effectType}`);
    const removedIndex = eventTypes.indexOf('TILE_EFFECT_REMOVED:smoke');
    const changedIndex = eventTypes.indexOf('TILE_EFFECT_CHANGED:fumes');
    expect(removedIndex).toBeGreaterThanOrEqual(0);
    expect(changedIndex).toBeGreaterThan(removedIndex);
  });

  it('повторный спавн дыма продлевает длительность без замены', () => {
    const state = makeGameState();
    spawnEffect(state, 'smoke', 3, 3);
    const {builder} = spawnEffect(state, 'smoke', 3, 3);

    const smoke = state.tileEffects[3]![3]!.aboveGround!;
    expect(smoke.type).toBe('smoke');
    expect(smoke.duration).toBe(4); // длительность шаблона применена повторно

    const hasRemoved = builder.root.children.some((child) => child.event.type === 'TILE_EFFECT_REMOVED');
    expect(hasRemoved).toBe(false);
  });
});
