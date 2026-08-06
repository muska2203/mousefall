/**
 * Рендерер тумана войны (Fog of War).
 *
 * Оверлей поверх карты:
 * - visible    → прозрачно
 * - explored   → полупрозрачно (тёмный оверлей)
 * - hidden     → непрозрачно (чёрное)
 */

import {Container, Graphics} from 'pixi.js';
import type {Position, RenderInput} from '@presentation/types';
import type {DisplayTile} from '@presentation/displayState/types';
import {FOG_EXPLORED_ALPHA, TILE_HEIGHT, TILE_SIZE} from '@utils/constants';
import {type EasingFn, lerp, runTickerTween, type TickerLike} from '@utils/tween';
import {cellRect} from './spritePlacement';

const COLOR_EXPLORED = 0x000000;
const ALPHA_EXPLORED = FOG_EXPLORED_ALPHA;
const ALPHA_HIDDEN = 1.0;

/** Нарисовать прямоугольник тумана для клетки: стоячий террейн покрывается целиком,
 *  остальные клетки — по геометрии сжатой сетки. */
function rectCell(g: Graphics, x: number, y: number, standing: boolean): void {
  if (standing) {
    g.rect(x * TILE_SIZE, (y + 1) * TILE_HEIGHT - TILE_SIZE, TILE_SIZE, TILE_SIZE);
  } else {
    const rect = cellRect(x, y);
    g.rect(rect.x, rect.y, rect.width, rect.height);
  }
}

export class FogRenderer {
  public readonly container = new Container();
  private graphics = new Graphics();
  /** Тайлы карты из последнего update (нужны animateReveal для формы клеток). */
  private lastTiles: DisplayTile[][] | null = null;

  constructor() {
    this.container.addChild(this.graphics);
  }

  update(input: RenderInput, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    if (input.debugEnabled) {
      this.graphics.clear();
      return;
    }

    const {visible, explored, width, height, tiles} = input.displayState.map;
    this.lastTiles = tiles;

    // Рисуем туман на всей видимой области, включая пространство за пределами карты
    const overrender = 1;
    const startCol = Math.floor(cameraX / TILE_SIZE) - overrender;
    const startRow = Math.floor(cameraY / TILE_HEIGHT) - overrender;
    const endCol = Math.ceil((cameraX + viewportWidth) / TILE_SIZE) + overrender;
    const endRow = Math.ceil((cameraY + viewportHeight) / TILE_HEIGHT) + overrender;

    this.graphics.clear();

    // Explored — один batch с полупрозрачной заливкой
    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const inBounds = x >= 0 && x < width && y >= 0 && y < height;
        if (inBounds && visible[y]![x]) continue;
        if (inBounds && explored[y]![x]) {
          rectCell(this.graphics, x, y, tiles[y]?.[x]?.standing === true);
        }
      }
    }
    this.graphics.fill({color: COLOR_EXPLORED, alpha: ALPHA_EXPLORED});

    // Hidden / out-of-bounds — второй batch с непрозрачной заливкой
    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const inBounds = x >= 0 && x < width && y >= 0 && y < height;
        if (inBounds && visible[y]![x]) continue;
        if (!inBounds || !explored[y]![x]) {
          rectCell(this.graphics, x, y, inBounds && tiles[y]?.[x]?.standing === true);
        }
      }
    }
    this.graphics.fill({color: COLOR_EXPLORED, alpha: ALPHA_HIDDEN});
  }

  /** Анимировать открытие тайлов: временный оверлей fade-out от explored к прозрачному. */
  animateReveal(
    positions: Position[],
    duration: number,
    easing: EasingFn,
    ticker: TickerLike,
  ): Promise<void> {
    if (positions.length === 0) return Promise.resolve();

    const overlay = new Graphics();
    for (const pos of positions) {
      rectCell(overlay, pos.x, pos.y, this.lastTiles?.[pos.y]?.[pos.x]?.standing === true);
    }
    overlay.fill({color: COLOR_EXPLORED, alpha: ALPHA_EXPLORED});
    overlay.alpha = ALPHA_EXPLORED;
    this.container.addChild(overlay);

    return new Promise<void>((resolve) => {
      runTickerTween(
        {
          duration,
          easing,
          onUpdate: (p) => {
            overlay.alpha = lerp(ALPHA_EXPLORED, 0, p);
          },
          onComplete: () => {
            overlay.destroy();
            resolve();
          },
        },
        ticker,
      );
    });
  }

  clear(): void {
    this.graphics.clear();
  }
}
