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
import {FOG_EXPLORED_ALPHA, TILE_SIZE} from '@utils/constants';
import {type EasingFn, lerp, runTickerTween, type TickerLike} from '@utils/tween';

const COLOR_EXPLORED = 0x000000;
const ALPHA_EXPLORED = FOG_EXPLORED_ALPHA;
const ALPHA_HIDDEN = 1.0;

export class FogRenderer {
  public readonly container = new Container();
  private graphics = new Graphics();

  constructor() {
    this.container.addChild(this.graphics);
  }

  update(input: RenderInput, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    if (input.debugEnabled) {
      this.graphics.clear();
      return;
    }

    const {visible, explored, width, height} = input.displayState.map;

    // Рисуем туман на всей видимой области, включая пространство за пределами карты
    const overrender = 1;
    const startCol = Math.floor(cameraX / TILE_SIZE) - overrender;
    const startRow = Math.floor(cameraY / TILE_SIZE) - overrender;
    const endCol = Math.ceil((cameraX + viewportWidth) / TILE_SIZE) + overrender;
    const endRow = Math.ceil((cameraY + viewportHeight) / TILE_SIZE) + overrender;

    this.graphics.clear();

    // Explored — один batch с полупрозрачной заливкой
    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const inBounds = x >= 0 && x < width && y >= 0 && y < height;
        if (inBounds && visible[y]![x]) continue;
        if (inBounds && explored[y]![x]) {
          this.graphics.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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
          this.graphics.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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
      overlay.rect(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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
