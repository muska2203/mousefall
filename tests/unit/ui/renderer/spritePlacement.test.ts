/**
 * Unit tests for spritePlacement — единая геометрия размещения спрайтов.
 *
 * Проверяет эквивалентность прежним формулам позиционирования
 * (STANDING_Y_FACTOR, TILE_EFFECT_STATUS_* и т.д.) для всех категорий.
 */

import {describe, expect, it, vi} from 'vitest';
import {Sprite} from 'pixi.js';
import {FLOOR_Y_RATIO, TILE_HEIGHT, TILE_SIZE} from '@utils/constants.ts';
import {
  applyPlacement,
  cellCenter,
  cellRect,
  placementAnchorPoint,
} from '@ui/renderer/spritePlacement.ts';
import {getSpritePlacement} from '@presentation/spritePlacementResolver.ts';

vi.mock('pixi.js', () => {
  class MockSprite {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    anchor = {
      x: 0,
      y: 0,
      set(ax: number, ay: number) {
        this.x = ax;
        this.y = ay;
      },
    };
  }
  return {Sprite: MockSprite};
});

/** Размещение категории без шаблона (чистый дефолт). */
function placementOf(category: Parameters<typeof getSpritePlacement>[1]) {
  return getSpritePlacement(undefined, category);
}

describe('cellRect / cellCenter', () => {
  it('cellRect — прямоугольник клетки на сжатой сетке', () => {
    expect(cellRect(2, 4)).toEqual({
      x: 2 * TILE_SIZE,
      y: 4 * TILE_HEIGHT,
      width: TILE_SIZE,
      height: TILE_HEIGHT,
    });
  });

  it('cellCenter — центр клетки на сжатой сетке', () => {
    expect(cellCenter(2, 4)).toEqual({
      x: 2 * TILE_SIZE + TILE_SIZE / 2,
      y: 4 * TILE_HEIGHT + TILE_HEIGHT / 2,
    });
  });
});

describe('applyPlacement — эквивалентность прежним формулам', () => {
  it('actor: якорь (0.5, 1), центр по X, низ на 0.8 высоты клетки', () => {
    const sprite = new Sprite();
    const anchor = applyPlacement(sprite, 2, 4, placementOf('actor'));
    expect(sprite.anchor.x).toBe(0.5);
    expect(sprite.anchor.y).toBe(1);
    expect(sprite.x).toBe(2 * TILE_SIZE + TILE_SIZE / 2);
    expect(sprite.y).toBe(4 * TILE_HEIGHT + TILE_HEIGHT * 0.8);
    expect(sprite.width).toBe(TILE_SIZE);
    expect(sprite.height).toBe(TILE_SIZE);
    expect(anchor).toEqual({x: sprite.x, y: sprite.y});
  });

  it('object: якорь (0, 1), левый край, низ на 0.8 высоты клетки', () => {
    const sprite = new Sprite();
    applyPlacement(sprite, 2, 4, placementOf('object'));
    expect(sprite.anchor.x).toBe(0);
    expect(sprite.anchor.y).toBe(1);
    expect(sprite.x).toBe(2 * TILE_SIZE);
    // Прежняя формула: y = y*TILE_HEIGHT + TILE_HEIGHT*STANDING_Y_FACTOR - height при якоре (0,0).
    expect(sprite.y).toBe(4 * TILE_HEIGHT + TILE_HEIGHT * 0.8);
    expect(sprite.width).toBe(TILE_SIZE);
    expect(sprite.height).toBe(TILE_SIZE);
  });

  it('trap: сплющен в плоскость пола (высота * FLOOR_Y_RATIO)', () => {
    const sprite = new Sprite();
    applyPlacement(sprite, 2, 4, placementOf('trap'));
    expect(sprite.anchor.y).toBe(0);
    expect(sprite.x).toBe(2 * TILE_SIZE);
    expect(sprite.y).toBe(4 * TILE_HEIGHT);
    expect(sprite.height).toBe(TILE_SIZE * FLOOR_Y_RATIO);
  });

  it('tileEffectCover: занимает всю сжатую клетку', () => {
    const sprite = new Sprite();
    applyPlacement(sprite, 2, 4, placementOf('tileEffectCover'));
    expect(sprite.x).toBe(2 * TILE_SIZE);
    expect(sprite.y).toBe(4 * TILE_HEIGHT);
    expect(sprite.width).toBe(TILE_SIZE);
    expect(sprite.height).toBe(TILE_HEIGHT);
  });

  it('tileEffectAboveGround: полный размер, низ на 0.8 высоты клетки', () => {
    const sprite = new Sprite();
    applyPlacement(sprite, 2, 4, placementOf('tileEffectAboveGround'));
    expect(sprite.anchor.y).toBe(1);
    expect(sprite.y).toBe(4 * TILE_HEIGHT + TILE_HEIGHT * 0.8);
    expect(sprite.width).toBe(TILE_SIZE);
    expect(sprite.height).toBe(TILE_SIZE);
  });

  it('tileEffectStatus: масштаб 0.7, центр по X, низ на 0.5 высоты клетки', () => {
    const sprite = new Sprite();
    applyPlacement(sprite, 2, 4, placementOf('tileEffectStatus'));
    expect(sprite.anchor.x).toBe(0.5);
    expect(sprite.anchor.y).toBe(1);
    expect(sprite.x).toBe(2 * TILE_SIZE + TILE_SIZE / 2);
    expect(sprite.y).toBe(4 * TILE_HEIGHT + TILE_HEIGHT * 0.5);
    expect(sprite.width).toBe(TILE_SIZE * 0.7);
    expect(sprite.height).toBe(TILE_SIZE * 0.7);
  });

  it('terrainStanding: полный размер, низ к низу клетки', () => {
    const sprite = new Sprite();
    applyPlacement(sprite, 2, 4, placementOf('terrainStanding'));
    expect(sprite.anchor.y).toBe(1);
    // Прежняя формула TileRenderer: y = (y+1)*TILE_HEIGHT - TILE_SIZE при якоре (0,0).
    expect(sprite.y).toBe((4 + 1) * TILE_HEIGHT);
    expect(sprite.width).toBe(TILE_SIZE);
    expect(sprite.height).toBe(TILE_SIZE);
  });
});

describe('placementAnchorPoint', () => {
  it('для flattenY возвращает верх клетки', () => {
    expect(placementAnchorPoint(1, 3, placementOf('trap'))).toEqual({
      x: 1 * TILE_SIZE,
      y: 3 * TILE_HEIGHT,
    });
  });

  it('для стоячих — точку привязки низа спрайта', () => {
    expect(placementAnchorPoint(1, 3, placementOf('actor'))).toEqual({
      x: 1 * TILE_SIZE + TILE_SIZE / 2,
      y: 3 * TILE_HEIGHT + TILE_HEIGHT * 0.8,
    });
  });
});
