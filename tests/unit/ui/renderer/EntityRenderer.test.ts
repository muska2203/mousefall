/**
 * Unit tests for EntityRenderer.
 */

import {describe, expect, it} from 'vitest';
import {EntityRenderer} from '../../../../src/ui/renderer/EntityRenderer';
import {ANIMATION_CONFIG} from '../../../../src/utils/animationConfig';
import type {RenderInput} from '../../../../src/presentation/types';

function makeRenderInput(playerOverrides?: Partial<RenderInput['state']['player']>): RenderInput {
  const player = {
    id: 'player' as const,
    type: 'player' as const,
    x: 0,
    y: 0,
    blocksMovement: true as const,
    hp: 10,
    maxHp: 10,
    armor: 0,
    damage: 2,
    maxAp: 3,
    ap: 3,
    xp: 0,
    level: 1,
    inventory: [],
    equippedWeaponId: null,
    equippedArmorId: null,
    equippedAmuletId: null,
    mp: 0,
    maxMp: 0,
    baseStats: { str: 0, dex: 0, int: 0, vit: 0 },
    statModifiers: [],
    statusEffects: [],
    ...playerOverrides,
  };

  return {
    state: {
      map: {width: 10, height: 10, tiles: [], rooms: []},
      mapParams: {
        id: 'floor_1',
        height: 10,
        width: 10,
        minRooms: 1,
        maxRooms: 2,
        minRoomSize: 3,
        maxRoomSize: 4,
        enemyDensity: 0,
        itemDensity: 0,
        enemyPool: [],
        itemPool: [],
      },
      entities: new Map(),
      player,
      visible: [],
      explored: [],
      turn: {activeSide: 'PLAYER' as const, round: 1},
      phase: 'playing' as const,
      floor: 1,
      floorSnapshots: [],
      rng: {seed: 1, state: 1},
      nextEntityCounter: 0,
    },
    portraitId: null,
    highlightedPath: null,
    animations: null,
    phase: 'idle' as const,
    zoom: 1,
  };
}

describe('EntityRenderer', () => {
  it('animateMove returns a Promise<void>', async () => {
    const renderer = new EntityRenderer();
    const input = makeRenderInput();
    renderer.update(input);

    const p = renderer.animateMove(
      'player',
      {x: 0, y: 0},
      {x: 1, y: 0},
      ANIMATION_CONFIG.MOVE
    );

    expect(p).toBeInstanceOf(Promise);

    // Завершаем анимацию вручную через ticker
    renderer.updateAnimations(performance.now() + ANIMATION_CONFIG.MOVE.duration + 10);
    await p;
  });

  it('interrupts previous animateMove when called again before finish', async () => {
    const renderer = new EntityRenderer();
    const input = makeRenderInput();
    renderer.update(input);

    const firstPromise = renderer.animateMove(
      'player',
      {x: 0, y: 0},
      {x: 1, y: 0},
      ANIMATION_CONFIG.MOVE
    );

    // Вторая анимация прерывает первую
    const secondPromise = renderer.animateMove(
      'player',
      {x: 1, y: 0},
      {x: 2, y: 0},
      ANIMATION_CONFIG.MOVE
    );

    // Первая Promise должна быть резолвлена (прервана)
    await firstPromise;

    // Завершаем вторую анимацию через ticker вручную
    renderer.updateAnimations(performance.now() + ANIMATION_CONFIG.MOVE.duration + 10);
    await secondPromise;

    const sprite = (renderer as any).sprites.get('player');
    expect(sprite.x).toBe(2 * 32); // TILE_SIZE = 32
    expect(sprite.y).toBe(0);
  });
});
