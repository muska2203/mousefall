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
  public viewportWidth: number;
  public viewportHeight: number;

  private tileRenderer = new TileRenderer();
  private entityRenderer = new EntityRenderer();
  private fogRenderer = new FogRenderer();

  private _scale = 1;
  private readonly minScale = 0.5;
  private readonly maxScale = 3;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.root.addChild(this.tileRenderer.container);
    this.root.addChild(this.entityRenderer.container);
    this.root.addChild(this.fogRenderer.container);
  }

  /** Обновить размеры viewport'а (например, при ресайзе контейнера). */
  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
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

    const s = this._scale;
    const viewW = this.viewportWidth / s;
    const viewH = this.viewportHeight / s;

    // Центрируем камеру на центре спрайта игрока.
    // В PixiJS экранная координата считается как: world * scale + position,
    // поэтому смещение корневого контейнера должно учитывать масштаб.
    const cameraX = playerScreenX + TILE_SIZE / 2 - viewW / 2;
    const cameraY = playerScreenY + TILE_SIZE / 2 - viewH / 2;

    // Обновляем слои (параллельно, кроме fog которая зависит от camera)
    await Promise.all([
      this.tileRenderer.update(state.map, cameraX, cameraY, viewW, viewH),
      this.entityRenderer.update(state, playerPortraitId),
    ]);

    this.fogRenderer.update(state, cameraX, cameraY, viewW, viewH);

    // Применяем масштаб и смещение к корневому контейнеру
    this.root.scale.set(s);
    this.root.x = -cameraX * s;
    this.root.y = -cameraY * s;
  }

  /** Текущий масштаб мира. */
  get scale(): number {
    return this._scale;
  }

  /** Изменить масштаб на заданную дельту (положительная — приближение). */
  zoom(delta: number): void {
    const factor = 1 + delta;
    this._scale = Math.max(this.minScale, Math.min(this.maxScale, this._scale * factor));
  }

  /** Сбросить масштаб к 1. */
  resetZoom(): void {
    this._scale = 1;
  }

  destroy(): void {
    this.tileRenderer.clear();
    this.entityRenderer.clear();
    this.fogRenderer.clear();
    this.root.destroy({children: true});
  }
}
