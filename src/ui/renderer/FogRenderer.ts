/**
 * Рендерер тумана войны (Fog of War).
 *
 * Оверлей поверх карты:
 * - visible    → прозрачно
 * - explored   → полупрозрачно (тёмный оверлей)
 * - hidden     → непрозрачно (чёрное)
 */

import {Container, Graphics} from 'pixi.js';
import type {RenderInput} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';

const COLOR_HIDDEN = 0x000000;
const COLOR_EXPLORED = 0x000000;
const ALPHA_EXPLORED = 0.55;
const ALPHA_HIDDEN = 1.0;

export class FogRenderer {
  public readonly container = new Container();
  private graphics = new Graphics();

  constructor() {
    this.container.addChild(this.graphics);
  }

  update(input: RenderInput, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    const {visible, explored, map} = input.state;

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
        const inBounds = x >= 0 && x < map.width && y >= 0 && y < map.height;
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
        const inBounds = x >= 0 && x < map.width && y >= 0 && y < map.height;
        if (inBounds && visible[y]![x]) continue;
        if (!inBounds || !explored[y]![x]) {
          this.graphics.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    this.graphics.fill({color: COLOR_EXPLORED, alpha: ALPHA_HIDDEN});
  }

  clear(): void {
    this.graphics.clear();
  }
}
