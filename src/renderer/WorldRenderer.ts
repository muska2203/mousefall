/**
 * Главный рендерер мира.
 *
 * Оркестрирует TileRenderer, EntityRenderer, FogRenderer.
 * Управляет камерой (центрирование на игроке) и viewport.
 */

import {Container} from 'pixi.js';
import type {GameState} from '@simulation/types';
import {TILE_SIZE} from '@utils/constants';
import {TileRenderer} from './TileRenderer';
import {EntityRenderer} from './EntityRenderer';
import {FogRenderer} from './FogRenderer';

export class WorldRenderer {
  public readonly root = new Container();
  public readonly viewportWidth: number;
  public readonly viewportHeight: number;

  private tileRenderer = new TileRenderer();
  private entityRenderer = new EntityRenderer();
  private fogRenderer = new FogRenderer();

  private cameraX = 0;
  private cameraY = 0;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.root.addChild(this.tileRenderer.container);
    this.root.addChild(this.entityRenderer.container);
    this.root.addChild(this.fogRenderer.container);
  }

  /**
   * Обновить отрисовку на основе текущего состояния игры.
   * @param state — readonly снимок GameState
   * @param playerPortraitId — id портрета игрока для выбора спрайта
   */
  async render(state: GameState, playerPortraitId: string | null): Promise<void> {
    // Центрируем камеру на игроке
    const playerScreenX = state.player.x * TILE_SIZE;
    const playerScreenY = state.player.y * TILE_SIZE;

    this.cameraX = playerScreenX - this.viewportWidth / 2 + TILE_SIZE / 2;
    this.cameraY = playerScreenY - this.viewportHeight / 2 + TILE_SIZE / 2;

    // Ограничиваем камеру границами карты
    const maxCamX = state.map.width * TILE_SIZE - this.viewportWidth;
    const maxCamY = state.map.height * TILE_SIZE - this.viewportHeight;
    this.cameraX = Math.max(0, Math.min(this.cameraX, maxCamX));
    this.cameraY = Math.max(0, Math.min(this.cameraY, maxCamY));

    // Обновляем слои (параллельно, кроме fog которая зависит от camera)
    await Promise.all([
      this.tileRenderer.update(state.map, this.cameraX, this.cameraY, this.viewportWidth, this.viewportHeight),
      this.entityRenderer.update(state, playerPortraitId),
    ]);

    this.fogRenderer.update(state, this.cameraX, this.cameraY, this.viewportWidth, this.viewportHeight);

    // Применяем смещение камеры к корневому контейнеру
    this.root.x = -this.cameraX;
    this.root.y = -this.cameraY;
  }

  destroy(): void {
    this.tileRenderer.clear();
    this.entityRenderer.clear();
    this.fogRenderer.clear();
    this.root.destroy({children: true});
  }
}
