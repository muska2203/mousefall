/**
 * Рендерер тумана войны (Fog of War).
 *
 * Оверлей поверх карты:
 * - visible    → прозрачно
 * - explored   → полупрозрачно (тёмный оверлей)
 * - hidden     → непрозрачно (чёрное)
 */

import {Container, Graphics} from 'pixi.js';
import type {GameState} from '@simulation/types';
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

  update(state: GameState, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    const {visible, explored, map} = state;

    const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(cameraY / TILE_SIZE));
    const endCol = Math.min(map.width, Math.ceil((cameraX + viewportWidth) / TILE_SIZE));
    const endRow = Math.min(map.height, Math.ceil((cameraY + viewportHeight) / TILE_SIZE));

    this.graphics.clear();

    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const isVisible = visible[y]?.[x] ?? false;
        if (isVisible) continue;

        const isExplored = explored[y]?.[x] ?? false;
        const alpha = isExplored ? ALPHA_EXPLORED : ALPHA_HIDDEN;

        this.graphics.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.graphics.fill({color: COLOR_EXPLORED, alpha});
      }
    }
  }

  clear(): void {
    this.graphics.clear();
  }
}
