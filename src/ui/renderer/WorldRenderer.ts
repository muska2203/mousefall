/**
 * Главный рендерер мира.
 *
 * Оркестрирует TileRenderer, EntityRenderer, FogRenderer.
 * Управляет камерой (центрирование на игроке) и viewport.
 * Поддерживает Promise-based анимации перемещения и плавное следование камеры.
 */

import {Container, Ticker, Graphics} from 'pixi.js';
import type {RenderInput, Position} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {TileRenderer} from './TileRenderer';
import {EntityRenderer} from './EntityRenderer';
import {FogRenderer} from './FogRenderer';
import {FloatingTextRenderer} from './FloatingTextRenderer';
import {TargetingRenderer} from './TargetingRenderer';
import type {AnimationConfigEntry} from '@utils/animationConfig';
import {Vec2Tween, type TickerLike, runTickerTween, lerp} from '@utils/tween';

type CameraAnimation = {
  tween: Vec2Tween;
};

export class WorldRenderer {
  public readonly root = new Container();
  /** Слой для текста, который не должен масштабироваться вместе с миром. */
  public readonly textLayer = new Container();
  public viewportWidth: number;
  public viewportHeight: number;

  private tileRenderer = new TileRenderer();
  private targetingRenderer = new TargetingRenderer();
  private entityRenderer = new EntityRenderer();
  private fogRenderer = new FogRenderer();
  private floatingTextRenderer = new FloatingTextRenderer();

  private cameraAnimation: CameraAnimation | null = null;
  private lastInput: RenderInput | null = null;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.root.addChild(this.tileRenderer.container);
    this.root.addChild(this.targetingRenderer.overlayContainer);
    this.root.addChild(this.entityRenderer.container);
    this.root.addChild(this.targetingRenderer.previewContainer);
    this.root.addChild(this.fogRenderer.container);

    this.textLayer.addChild(this.targetingRenderer.previewTextContainer);
    this.textLayer.addChild(this.floatingTextRenderer.container);
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
  render(input: RenderInput): void {
    this.lastInput = input;
    const playerScreenX = input.state.player.x * TILE_SIZE;
    const playerScreenY = input.state.player.y * TILE_SIZE;

    const scale = input.zoom;
    const viewW = this.viewportWidth / scale;
    const viewH = this.viewportHeight / scale;

    const cameraX = playerScreenX + TILE_SIZE / 2 - viewW / 2;
    const cameraY = playerScreenY + TILE_SIZE / 2 - viewH / 2;

    this.tileRenderer.update(input, cameraX, cameraY, viewW, viewH);
    this.targetingRenderer.update(input);
    this.entityRenderer.update(input);
    this.fogRenderer.update(input, cameraX, cameraY, viewW, viewH);

    this.root.scale.set(scale);
    this.root.x = -cameraX * scale;
    this.root.y = -cameraY * scale;

    this.syncTextLayer();
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

  /** Анимировать каст способности (пульсация спрайта кастера). */
  animateAbilityCast(entityId: string, config: AnimationConfigEntry): Promise<void> {
    return this.entityRenderer.animateCast(entityId, config);
  }

  /** Анимировать полёт снаряда от кастера до цели.
   *  Рисует красный круг, который движется по прямой между центрами тайлов.
   *  Использует runTickerTween, чтобы tween обновлялся через PixiJS ticker. */
  animateProjectile(from: Position, to: Position, config: AnimationConfigEntry, ticker: TickerLike): Promise<void> {
    return new Promise((resolve) => {
      const g = new Graphics();
      const radius = TILE_SIZE / 4;
      g.circle(0, 0, radius);
      g.fill({ color: 0xff3300 });

      const fromX = from.x * TILE_SIZE + TILE_SIZE / 2;
      const fromY = from.y * TILE_SIZE + TILE_SIZE / 2;
      const toX = to.x * TILE_SIZE + TILE_SIZE / 2;
      const toY = to.y * TILE_SIZE + TILE_SIZE / 2;

      g.x = fromX;
      g.y = fromY;
      this.root.addChild(g);

      runTickerTween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          g.x = lerp(fromX, toX, p);
          g.y = lerp(fromY, toY, p);
        },
        onComplete: () => {
          g.destroy();
          resolve();
        },
      }, ticker);
    });
  }

  /** Анимировать взрыв в указанной позиции.
   *  Красный круг расширяется и растворяется.
   *  Использует runTickerTween, чтобы tween обновлялся через PixiJS ticker. */
  animateExplosion(center: Position, config: AnimationConfigEntry, ticker: TickerLike): Promise<void> {
    return new Promise((resolve) => {
      const g = new Graphics();
      const baseRadius = TILE_SIZE / 2;
      g.circle(0, 0, baseRadius);
      g.fill({ color: 0xff3300, alpha: 0.8 });

      const centerX = center.x * TILE_SIZE + TILE_SIZE / 2;
      const centerY = center.y * TILE_SIZE + TILE_SIZE / 2;
      g.x = centerX;
      g.y = centerY;
      this.root.addChild(g);

      runTickerTween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          g.scale.set(lerp(1, 2.5, p));
          g.alpha = lerp(0.8, 0, p);
        },
        onComplete: () => {
          g.destroy();
          resolve();
        },
      }, ticker);
    });
  }

  /** Преобразовать экранные координаты в координаты тайла мира.
   *  Использует ту же логику камеры, что и render(). */
  screenToWorld(screenX: number, screenY: number): Position {
    const input = this.lastInput;
    if (!input) return { x: 0, y: 0 };
    const scale = input.zoom;
    const playerScreenX = input.state.player.x * TILE_SIZE;
    const playerScreenY = input.state.player.y * TILE_SIZE;
    const viewW = this.viewportWidth / scale;
    const viewH = this.viewportHeight / scale;
    const cameraX = playerScreenX + TILE_SIZE / 2 - viewW / 2;
    const cameraY = playerScreenY + TILE_SIZE / 2 - viewH / 2;
    return {
      x: Math.floor((screenX / scale + cameraX) / TILE_SIZE),
      y: Math.floor((screenY / scale + cameraY) / TILE_SIZE),
    };
  }

  /** Показать всплывающий текст в мировых координатах. */
  showFloatingText(text: string, worldX: number, worldY: number, color: string, duration: number, zoom?: number): void {
    const z = zoom ?? this.lastInput?.zoom ?? 1;
    this.floatingTextRenderer.show(text, worldX, worldY, color, duration, z);
    // Сразу синхронизируем позицию, чтобы текст не мигал в (0,0) до следующего тика
    this.syncTextLayer();
  }

  /** Анимировать открытие тайлов тумана войны. */
  animateFogReveal(
    positions: Position[],
    config: AnimationConfigEntry,
    ticker: TickerLike,
  ): Promise<void> {
    return this.fogRenderer.animateReveal(positions, config.duration, config.easing, ticker);
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
    this.syncTextLayer();
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

  /** Синхронизировать позиции текстовых элементов в экранные координаты.
   *  Использует текущую трансформацию root (камера + zoom), чтобы текст
   *  двигался плавно вместе с миром, включая камерные анимации. */
  private syncTextLayer(): void {
    const scale = this.root.scale.x || 1;
    for (const container of this.textLayer.children) {
      for (const child of container.children) {
        const coords = this.targetingRenderer.textWorldCoords.get(child)
          ?? this.floatingTextRenderer.textWorldCoords.get(child);
        const wx = coords?.worldX ?? child.x;
        const wy = coords?.worldY ?? child.y;
        child.x = wx * scale + this.root.x;
        child.y = wy * scale + this.root.y;
      }
    }
  }

  destroy(): void {
    this.tileRenderer.clear();
    this.targetingRenderer.clear();
    this.entityRenderer.clear();
    this.fogRenderer.clear();
    this.floatingTextRenderer.clear();
    this.cameraAnimation = null;
    this.lastInput = null;
    this.root.destroy({children: true});
    this.textLayer.destroy({children: true});
  }
}
