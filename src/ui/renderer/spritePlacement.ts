/**
 * Единая геометрия размещения спрайтов и клеток на поле.
 *
 * Все рендереры и анимационные исполнители получают экранные координаты
 * только через этот модуль — формулы не размазываются по коду.
 *
 * Модель мира: сетка клеток (x — колонка, y — строка) проецируется на экран
 * с вертикальным сжатием плоскости пола (TILE_HEIGHT < TILE_SIZE, псевдо-3D).
 * Размещение конкретного спрайта в клетке описывается ResolvedSpritePlacement
 * (дефолты категорий и переопределения шаблонов — в presentation/spritePlacementResolver).
 */

import type {Sprite} from 'pixi.js';
import type {ResolvedSpritePlacement} from '@presentation/spritePlacementResolver';
import {FLOOR_Y_RATIO, TILE_HEIGHT, TILE_SIZE} from '@utils/constants';

/** Экранная точка. */
export type ScreenPoint = {
  x: number;
  y: number;
};

/** Прямоугольник клетки на экране. */
export type CellRect = ScreenPoint & {
  width: number;
  height: number;
};

/** Прямоугольник клетки на сжатой сетке (пол, туман, таргетинг, debug-оверлеи). */
export function cellRect(x: number, y: number): CellRect {
  return {x: x * TILE_SIZE, y: y * TILE_HEIGHT, width: TILE_SIZE, height: TILE_HEIGHT};
}

/** Центр клетки на сжатой сетке (анимации, камера, точечные эффекты). */
export function cellCenter(x: number, y: number): ScreenPoint {
  return {x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_HEIGHT + TILE_HEIGHT / 2};
}

/**
 * Опорная точка размещения спрайта в клетке.
 * Для обычных («стоячих») спрайтов — точка, к которой привязан низ спрайта.
 * Для сплющенных (flattenY) — точка привязки верха (спрайт ложится на сжатую сетку).
 */
export function placementAnchorPoint(
  x: number,
  y: number,
  placement: ResolvedSpritePlacement,
): ScreenPoint {
  return {
    x: x * TILE_SIZE + TILE_SIZE * placement.anchorX,
    y: placement.flattenY
      ? y * TILE_HEIGHT
      : y * TILE_HEIGHT + TILE_HEIGHT * placement.anchorY,
  };
}

/**
 * Применить размещение к спрайту: якорь, позиция и размер.
 * Возвращает опорную точку (удобно для zIndex и анимаций).
 */
export function applyPlacement(
  sprite: Sprite,
  x: number,
  y: number,
  placement: ResolvedSpritePlacement,
): ScreenPoint {
  const {width, height} = placementSize(placement);
  const anchor = placementAnchorPoint(x, y, placement);
  sprite.anchor.set(placement.anchorX, placement.flattenY ? 0 : 1);
  sprite.x = anchor.x;
  sprite.y = anchor.y;
  sprite.width = width;
  sprite.height = height;
  return anchor;
}

/** Размер спрайта для размещения (без учёта позиции и якоря). */
export function placementSize(placement: ResolvedSpritePlacement): { width: number; height: number } {
  const size = TILE_SIZE * placement.scale;
  return {width: size, height: placement.flattenY ? size * FLOOR_Y_RATIO : size};
}
