/**
 * Unit tests for TileRenderer — тряска тайлов (shakeCells/shakeTiles).
 *
 * Проверяет, что стены (standing-террейн) не участвуют в тряске,
 * а спрайты пола после анимации возвращаются на исходные позиции.
 */

import {describe, expect, it, vi} from 'vitest';
import {TILE_HEIGHT, TILE_SIZE} from '@utils/constants.ts';
import {TileRenderer} from '@ui/renderer/TileRenderer.ts';

/** Захваченные параметры последнего вызова runTickerTween (управляем анимацией вручную). */
const hoisted = vi.hoisted(() => ({ tweenOpts: null as any }));

vi.mock('pixi.js', () => {
  class MockSprite {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    visible = true;
    texture: unknown = null;
    anchor = {
      x: 0,
      y: 0,
      set(ax: number, ay: number) {
        this.x = ax;
        this.y = ay;
      },
    };
    destroy(): void {}
  }
  class MockContainer {
    children: unknown[] = [];
    addChild(sprite: unknown): void {
      this.children.push(sprite);
    }
    removeChildren(): void {
      this.children = [];
    }
  }
  return {Sprite: MockSprite, Container: MockContainer, Texture: {EMPTY: {}}};
});

vi.mock('@ui/renderer/spriteRegistry.ts', () => ({
  getTileSprite: (type: string) => `tile_${type}.png`,
}));

vi.mock('@ui/renderer/TextureCache.ts', () => ({
  getTextureSync: () => ({}),
  getTexture: () => Promise.resolve({}),
}));

// «Стоячее» размещение не важно — фиксируем произвольную базовую позицию спрайта.
vi.mock('@ui/renderer/spritePlacement.ts', () => ({
  applyPlacement: (sprite: { x: number; y: number }, x: number, y: number) => {
    sprite.x = x * TILE_SIZE;
    sprite.y = y * TILE_HEIGHT;
  },
}));

vi.mock('@presentation/spritePlacementResolver.ts', () => ({
  getSpritePlacement: () => ({}),
}));

vi.mock('@utils/tween.ts', () => ({
  runTickerTween: (opts: unknown) => {
    hoisted.tweenOpts = opts;
  },
}));

/** Карта 3×1: стена слева, две клетки пола. */
function makeInput() {
  return {
    displayState: {
      map: {
        width: 3,
        height: 1,
        tiles: [[
          { type: 'wall', standing: true },
          { type: 'floor', standing: false },
          { type: 'floor', standing: false },
        ]],
      },
    },
  } as any;
}

function makeRenderer() {
  const renderer = new TileRenderer();
  renderer.update(makeInput(), 0, 0, 3 * TILE_SIZE, TILE_HEIGHT);
  // Порядок обхода — по строкам: (0,0) стена, (1,0) пол, (2,0) пол.
  const [wall, floor] = (renderer.container as any).children as { x: number; y: number }[];
  return { renderer, wall: wall!, floor: floor! };
}

describe('TileRenderer — тряска тайлов', () => {
  it('shakeCells не трогает стены и возвращает пол на место после анимации', async () => {
    const { renderer, wall, floor } = makeRenderer();
    const floorBaseX = floor.x;

    const promise = renderer.shakeCells([{ x: 0, y: 0 }, { x: 1, y: 0 }], 100, {} as any);

    // В середине анимации: пол сдвинут, стена осталась на месте.
    hoisted.tweenOpts.onUpdate(0.5);
    expect(floor.x).not.toBe(floorBaseX);
    expect(wall.x).toBe(0);
    expect(wall.y).toBe(0);

    hoisted.tweenOpts.onComplete();
    await promise;

    // После завершения спрайт пола возвращён на исходную позицию.
    expect(floor.x).toBe(floorBaseX);
  });

  it('shakeCells только из стен завершается сразу, без запуска tween', async () => {
    const { renderer } = makeRenderer();
    hoisted.tweenOpts = null;

    await renderer.shakeCells([{ x: 0, y: 0 }], 100, {} as any);

    expect(hoisted.tweenOpts).toBeNull();
  });

  it('shakeTiles (режим радиуса) также исключает стены', async () => {
    const { renderer, wall, floor } = makeRenderer();
    const floorBaseX = floor.x;

    // Центр (1,0), радиус 1: в зону попадают стена (0,0) и пол (2,0).
    const promise = renderer.shakeTiles({ x: 1, y: 0 }, 1, 100, {} as any);

    hoisted.tweenOpts.onUpdate(0.5);
    expect(wall.x).toBe(0);
    expect(floor.x).toBe(floorBaseX); // центр квадрата не трясётся по контракту радиуса

    hoisted.tweenOpts.onComplete();
    await promise;
  });
});
