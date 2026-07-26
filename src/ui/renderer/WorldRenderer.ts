/**
 * Главный рендерер мира.
 *
 * Оркестрирует TileRenderer, EntityRenderer, FogRenderer.
 * Управляет камерой (центрирование на игроке) и viewport.
 * Поддерживает Promise-based анимации перемещения и плавное следование камеры.
 */

import {Container, Ticker} from 'pixi.js';
import type {Position, RenderInput} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {TileRenderer} from './TileRenderer';
import {TileEffectRenderer} from './TileEffectRenderer';
import {TileEffectStatusRenderer} from './TileEffectStatusRenderer';
import {EntityRenderer} from './EntityRenderer';
import {FogRenderer} from './FogRenderer';
import {FloatingTextRenderer} from './FloatingTextRenderer';
import {TargetingRenderer} from './TargetingRenderer';
import {DebugMapRenderer} from './DebugMapRenderer';
import {UnitInfoRenderer} from './UnitInfoRenderer';
import type {AnimationConfigEntry} from '@utils/animationConfig';
import {lerp, type TickerLike, Tween} from '@utils/tween';

type CameraAnimation = {
  tween: Tween;
};

export class WorldRenderer {
  public readonly root = new Container();
  /** Слой для текста, который не должен масштабироваться вместе с миром. */
  public readonly textLayer = new Container();
  public viewportWidth: number;
  public viewportHeight: number;

  private tileRenderer = new TileRenderer();
  private tileEffectRenderer = new TileEffectRenderer();
  private targetingRenderer = new TargetingRenderer();
  private entityRenderer = new EntityRenderer();
  private tileEffectStatusRenderer = new TileEffectStatusRenderer(this.entityRenderer.container);
  private fogRenderer = new FogRenderer();
  private floatingTextRenderer = new FloatingTextRenderer();
  private debugMapRenderer = new DebugMapRenderer();
  public readonly unitInfoRenderer = new UnitInfoRenderer();

  private cameraAnimation: CameraAnimation | null = null;
  /** Текущая мировая позиция камеры (в пикселях тайлов), обновляется tween'ом. */
  private _cameraWorldPos: { x: number; y: number } | null = null;
  private lastInput: RenderInput | null = null;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    // Порядок слоёв важен:
    // 1. тайлы пола
    // 2. debug-оверлей комнат и коридоров — под туманом, чтобы не мешал игре
    // 3. тайловые эффекты — поверх пола, под туманом
    // 4. подсветка клеток (таргетинг) и автопуть — поверх тайловых эффектов, под туманом,
    //    чтобы превью пути и интентов не прятались под эффектами
    // 5. туман войны — затемняет пол, эффекты и подсветку, но не сущности
    // 6. сущности, предметы и статусы тайловых эффектов — в одном контейнере
    //    поверх тумана, чтобы большие спрайты не обрезались и сортировались по Y
    // 7. превью интентов (стрелки, цифры урона) — поверх сущностей
    this.root.addChild(this.tileRenderer.container);
    this.root.addChild(this.debugMapRenderer.container);
    this.root.addChild(this.tileEffectRenderer.container);
    this.root.addChild(this.targetingRenderer.overlayContainer);
    this.root.addChild(this.fogRenderer.container);
    this.root.addChild(this.entityRenderer.container);
    this.root.addChild(this.unitInfoRenderer.container);
    this.root.addChild(this.targetingRenderer.previewContainer);

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
   *
   * Правила работы с камерой:
   * - Если активна камерная анимация — root-позиция вычисляется из текущей
   *   мировой позиции камеры (cameraWorldPos) и актуального zoom'а. Это
   *   предотвращает телепорт при изменении масштаба/ресайзе во время движения.
   * - Вне анимации камера центрируется на игроке из DisplayState. Поскольку
   *   DisplayState обновляется патчами по завершении анимаций, камера не
   *   телепортируется в конечную позицию раньше времени.
   */
  render(input: RenderInput): void {
    this.lastInput = input;

    const scale = input.zoom;
    const viewW = this.viewportWidth / scale;
    const viewH = this.viewportHeight / scale;

    let cameraX: number;
    let cameraY: number;

    this.root.scale.set(scale);

    if (this.cameraAnimation && this._cameraWorldPos) {
      // Пока активна камерная анимация, мировая позиция камеры управляется tween'ом.
      // render() только применяет текущий zoom к уже вычисленным мировым координатам.
      cameraX = this._cameraWorldPos.x;
      cameraY = this._cameraWorldPos.y;
      this.root.x = -cameraX * scale;
      this.root.y = -cameraY * scale;
    } else {
      const player = input.displayState.player;
      const playerScreenX = player.x * TILE_SIZE;
      const playerScreenY = player.y * TILE_SIZE;

      cameraX = playerScreenX + TILE_SIZE / 2 - viewW / 2;
      cameraY = playerScreenY + TILE_SIZE / 2 - viewH / 2;

      this.root.x = -cameraX * scale;
      this.root.y = -cameraY * scale;
      this._cameraWorldPos = { x: cameraX, y: cameraY };
    }

    this.tileRenderer.update(input, cameraX, cameraY, viewW, viewH);
    this.debugMapRenderer.update(input);
    this.targetingRenderer.update(input);
    this.tileEffectRenderer.update(input, cameraX, cameraY, viewW, viewH);
    this.entityRenderer.update(input);
    this.fogRenderer.update(input, cameraX, cameraY, viewW, viewH);
    this.tileEffectStatusRenderer.update(input, cameraX, cameraY, viewW, viewH);
    this.unitInfoRenderer.update(input, (id) => this.entityRenderer.getSprite(id));

    this.syncTextLayer();
  }

  // ── Promise-based анимации ───────────────────────────────────────

  /** Анимировать прыжок сущности. */
  animateJump(entityId: string, from: Position, to: Position, config: AnimationConfigEntry): Promise<void> {
    const promises: Promise<void>[] = [
      this.entityRenderer.animateJump(entityId, from, to, config),
    ];

    if (entityId === this.lastInput?.displayState.player.id) {
      promises.push(this.animateCamera(from, to, config));
    }

    return Promise.all(promises).then(() => {});
  }

  /** Анимировать тряску тайлов вокруг точки. */
  animateTileShake(center: Position, radius: number, config: AnimationConfigEntry, ticker: TickerLike): Promise<void> {
    return this.tileRenderer.shakeTiles(center, radius, config.duration, ticker);
  }

  /** Анимировать перемещение сущности. Если followCamera — камера следует за ней. */
  animateMove(entityId: string, from: Position, to: Position, config: AnimationConfigEntry, followCamera: boolean, sway: boolean = true): Promise<void> {
    const promises: Promise<void>[] = [
      this.entityRenderer.animateMove(entityId, from, to, config, sway),
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

  /** Анимировать изменение заполнения полоски HP сущности. */
  animateHpChange(entityId: string, fromHp: number, toHp: number, maxHp: number, config: AnimationConfigEntry): Promise<void> {
    return this.unitInfoRenderer.animateHpChange(entityId, fromHp, toHp, maxHp, config);
  }

  /** Анимировать отскок сущности при столкновении с препятствием. */
  animateBounce(entityId: string, x: number, y: number, dx: number, dy: number, config: AnimationConfigEntry): Promise<void> {
    return this.entityRenderer.animateBounce(entityId, x, y, dx, dy, config);
  }

  /** Анимировать появление предмета (перелёт от from к to + fade-in + scale-up). */
  animateItemDrop(entityId: string, from: Position, to: Position, config: AnimationConfigEntry): Promise<void> {
    return this.entityRenderer.animateItemDrop(entityId, from, to, config);
  }

  /** Анимировать каст способности (пульсация спрайта кастера). */
  animateAbilityCast(entityId: string, config: AnimationConfigEntry): Promise<void> {
    return this.entityRenderer.animateCast(entityId, config);
  }

  /** Текущая мировая позиция камеры (в пикселях тайлов) или null до первого render(). */
  get cameraWorldPos(): { x: number; y: number } | null {
    return this._cameraWorldPos;
  }

  /** Преобразовать экранные координаты в координаты тайла мира.
   *  Использует текущую мировую позицию камеры, вычисленную в render(). */
  screenToWorld(screenX: number, screenY: number): Position {
    const input = this.lastInput;
    if (!input) return { x: 0, y: 0 };
    const scale = input.zoom;
    const cameraWorldPos = this._cameraWorldPos ?? this.computeCameraWorldPos(input);
    return {
      x: Math.floor((screenX / scale + cameraWorldPos.x) / TILE_SIZE),
      y: Math.floor((screenY / scale + cameraWorldPos.y) / TILE_SIZE),
    };
  }

  /** Вычислить мировую позицию камеры по состоянию (fallback до первого render()). */
  private computeCameraWorldPos(input: RenderInput): { x: number; y: number } {
    const scale = input.zoom;
    const viewW = this.viewportWidth / scale;
    const viewH = this.viewportHeight / scale;
    const player = input.displayState.player;
    return {
      x: player.x * TILE_SIZE + TILE_SIZE / 2 - viewW / 2,
      y: player.y * TILE_SIZE + TILE_SIZE / 2 - viewH / 2,
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
      // Прерываем предыдущую камерную анимацию, чтобы старый onComplete не сбросил
      // новый tween и чтобы камера плавно продолжила движение от текущей позиции.
      if (this.cameraAnimation) {
        this.cameraAnimation.tween.cancel();
      }

      // Анимируем прогресс от 0 до 1, а мировые координаты пересчитываем каждый кадр.
      // Это корректно обрабатывает изменение zoom'а или ресайза во время движения камеры.
      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          const scale = this.root.scale.x || 1;
          const viewW = this.viewportWidth / scale;
          const viewH = this.viewportHeight / scale;

          const fromX = fromTile.x * TILE_SIZE + TILE_SIZE / 2 - viewW / 2;
          const fromY = fromTile.y * TILE_SIZE + TILE_SIZE / 2 - viewH / 2;
          const toX = toTile.x * TILE_SIZE + TILE_SIZE / 2 - viewW / 2;
          const toY = toTile.y * TILE_SIZE + TILE_SIZE / 2 - viewH / 2;

          const x = lerp(fromX, toX, p);
          const y = lerp(fromY, toY, p);

          this._cameraWorldPos = { x, y };
        },
        onComplete: () => {
          // Защита от устаревшего onComplete: старый tween мог быть отменён.
          if (this.cameraAnimation?.tween !== tween) return;
          this.cameraAnimation = null;
          const scale = this.root.scale.x || 1;
          const viewW = this.viewportWidth / scale;
          const viewH = this.viewportHeight / scale;
          this._cameraWorldPos = {
            x: toTile.x * TILE_SIZE + TILE_SIZE / 2 - viewW / 2,
            y: toTile.y * TILE_SIZE + TILE_SIZE / 2 - viewH / 2,
          };
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
    this.tileEffectStatusRenderer.updateAnimations(now);
    this.unitInfoRenderer.updateAnimations(now);
    this.floatingTextRenderer.update(now);
    this.unitInfoRenderer.syncPositions((id) => this.entityRenderer.getSprite(id));
    this.updateCamera(now);
    this.syncTextLayer();
  };

  private updateCamera(now: number): void {
    if (!this.cameraAnimation || !this._cameraWorldPos) return;
    const finished = this.cameraAnimation.tween.update(now);
    if (finished) {
      this.cameraAnimation = null;
    }
    // Применяем текущий zoom к мировой позиции камеры. Это корректно обрабатывает
    // изменение масштаба во время движения камеры.
    const scale = this.root.scale.x || 1;
    this.root.x = -this._cameraWorldPos.x * scale;
    this.root.y = -this._cameraWorldPos.y * scale;
  }

  /** Возвращает true, если камера сейчас анимируется. */
  isCameraAnimating(): boolean {
    return this.cameraAnimation !== null;
  }

  /** Преобразовать мировые координаты тайла в экранные координаты относительно viewport. */
  worldToScreen(worldPos: Position): { x: number; y: number } {
    if (!this.lastInput) {
      return { x: worldPos.x * TILE_SIZE, y: worldPos.y * TILE_SIZE };
    }
    const scale = this.lastInput.zoom;
    const cameraWorldPos = this._cameraWorldPos ?? this.computeCameraWorldPos(this.lastInput);
    return {
      x: (worldPos.x * TILE_SIZE - cameraWorldPos.x) * scale,
      y: (worldPos.y * TILE_SIZE - cameraWorldPos.y) * scale,
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
    this.tileEffectRenderer.clear();
    this.tileEffectStatusRenderer.clear();
    this.targetingRenderer.clear();
    this.entityRenderer.clear();
    this.fogRenderer.clear();
    this.floatingTextRenderer.clear();
    this.unitInfoRenderer.destroy();
    this.cameraAnimation = null;
    this._cameraWorldPos = null;
    this.lastInput = null;
    this.root.destroy({children: true});
    this.textLayer.destroy({children: true});
  }
}
