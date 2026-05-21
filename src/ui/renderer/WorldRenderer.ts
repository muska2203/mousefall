/**
 * Главный рендерер мира.
 *
 * Оркестрирует TileRenderer, EntityRenderer, FogRenderer.
 * Управляет камерой (центрирование на игроке) и viewport.
 * Поддерживает Promise-based анимации перемещения и плавное следование камеры.
 */

import {Container, Ticker} from 'pixi.js';
import type {RenderInput, Position} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {TileRenderer} from './TileRenderer';
import {EntityRenderer} from './EntityRenderer';
import {FogRenderer} from './FogRenderer';
import {FloatingTextRenderer} from './FloatingTextRenderer';
import type {AnimationConfigEntry} from '@utils/animationConfig';
import {Vec2Tween} from '@utils/tween';

type CameraAnimation = {
  tween: Vec2Tween;
};

export class WorldRenderer {
  public readonly root = new Container();
  public viewportWidth: number;
  public viewportHeight: number;

  private tileRenderer = new TileRenderer();
  private entityRenderer = new EntityRenderer();
  private fogRenderer = new FogRenderer();
  private floatingTextRenderer = new FloatingTextRenderer();

  private cameraAnimation: CameraAnimation | null = null;
  private lastInput: RenderInput | null = null;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.root.addChild(this.tileRenderer.container);
    this.root.addChild(this.entityRenderer.container);
    this.root.addChild(this.floatingTextRenderer.container);
    this.root.addChild(this.fogRenderer.container);
  }

  /** Подключить PixiJS ticker для анимаций. */
  setTicker(ticker: Ticker): void {
    ticker.add(this.onTick);
  }

  /** Отключить PixiJS ticker. */
  removeTicker(ticker: Ticker): void {
    ticker.remove(this.onTick);
  }

  /** Обновить размеры viewport'а (например, при ресайзе контейнера). */
  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Обновить отрисовку на основе текущего состояния игры.
   * Если идёт камера-анимация, root-позиция будет переопределена в ticker.
   */
  async render(input: RenderInput): Promise<void> {
    this.lastInput = input;
    const playerScreenX = input.state.player.x * TILE_SIZE;
    const playerScreenY = input.state.player.y * TILE_SIZE;

    const scale = input.zoom;
    const viewW = this.viewportWidth / scale;
    const viewH = this.viewportHeight / scale;

    const cameraX = playerScreenX + TILE_SIZE / 2 - viewW / 2;
    const cameraY = playerScreenY + TILE_SIZE / 2 - viewH / 2;

    await Promise.all([
      this.tileRenderer.update(input, cameraX, cameraY, viewW, viewH),
      this.entityRenderer.update(input),
    ]);

    this.fogRenderer.update(input, cameraX, cameraY, viewW, viewH);

    this.root.scale.set(scale);
    this.root.x = -cameraX * scale;
    this.root.y = -cameraY * scale;
  }

  // ── Promise-based анимации ───────────────────────────────────────

  /** Анимировать перемещение сущности. Если followCamera — камера следует за ней. */
  animateMove(entityId: string, from: Position, to: Position, config: AnimationConfigEntry, followCamera: boolean): Promise<void> {
    const promises: Promise<void>[] = [
      this.entityRenderer.animateMove(entityId, from, to, config),
    ];

    if (followCamera) {
      promises.push(this.animateCamera(from, to, config));
    }

    return Promise.all(promises).then(() => {});
  }

  /** Анимировать атаку (спрайтовый сдвиг). */
  animateAttack(entityId: string, dx: number, dy: number, config: AnimationConfigEntry): Promise<void> {
    return this.entityRenderer.animateAttack(entityId, dx, dy, config);
  }

  /** Анимировать смерть (fade-out + scale-down). */
  animateDeath(entityId: string, config: AnimationConfigEntry): Promise<void> {
    return this.entityRenderer.animateDeath(entityId, config);
  }

  /** Показать всплывающий текст в мировых координатах. */
  showFloatingText(text: string, worldX: number, worldY: number, color: string, duration: number): void {
    this.floatingTextRenderer.show(text, worldX, worldY, color, duration);
  }

  /** Анимировать движение камеры между двумя тайлами. */
  animateCamera(fromTile: Position, toTile: Position, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const scale = this.root.scale.x || 1;
      const viewW = this.viewportWidth / scale;
      const viewH = this.viewportHeight / scale;

      const fromX = fromTile.x * TILE_SIZE + TILE_SIZE / 2 - viewW / 2;
      const fromY = fromTile.y * TILE_SIZE + TILE_SIZE / 2 - viewH / 2;
      const toX = toTile.x * TILE_SIZE + TILE_SIZE / 2 - viewW / 2;
      const toY = toTile.y * TILE_SIZE + TILE_SIZE / 2 - viewH / 2;

      // Если предыдущая камера-анимация ещё не завершена — мгновенно доводим
      if (this.cameraAnimation) {
        this.root.x = -toX * scale;
        this.root.y = -toY * scale;
      }

      const tween = new Vec2Tween({
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        duration: config.duration,
        easing: config.easing,
        onUpdate: (x, y) => {
          this.root.x = -x * scale;
          this.root.y = -y * scale;
        },
        onComplete: () => {
          this.cameraAnimation = null;
          resolve();
        },
      });

      this.cameraAnimation = { tween };
      tween.start(performance.now());
    });
  }

  // ── Ticker callback ──────────────────────────────────────────────

  private onTick = (): void => {
    const now = performance.now();
    this.entityRenderer.updateAnimations(now);
    this.floatingTextRenderer.update(now);
    this.updateCamera(now);
  };

  private updateCamera(now: number): void {
    if (!this.cameraAnimation) return;
    const finished = this.cameraAnimation.tween.update(now);
    if (finished) {
      this.cameraAnimation = null;
    }
  }

  /** Преобразовать мировые координаты тайла в экранные координаты относительно viewport. */
  worldToScreen(worldPos: Position): { x: number; y: number } {
    if (!this.lastInput) {
      return { x: worldPos.x * TILE_SIZE, y: worldPos.y * TILE_SIZE };
    }
    const scale = this.lastInput.zoom;
    const playerScreenX = this.lastInput.state.player.x * TILE_SIZE;
    const playerScreenY = this.lastInput.state.player.y * TILE_SIZE;
    const viewW = this.viewportWidth / scale;
    const viewH = this.viewportHeight / scale;
    const cameraX = playerScreenX + TILE_SIZE / 2 - viewW / 2;
    const cameraY = playerScreenY + TILE_SIZE / 2 - viewH / 2;
    return {
      x: (worldPos.x * TILE_SIZE - cameraX) * scale,
      y: (worldPos.y * TILE_SIZE - cameraY) * scale,
    };
  }

  destroy(): void {
    this.tileRenderer.clear();
    this.entityRenderer.clear();
    this.fogRenderer.clear();
    this.floatingTextRenderer.clear();
    this.cameraAnimation = null;
    this.lastInput = null;
    this.root.destroy({children: true});
  }
}
