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
import {DebugMapRenderer} from './DebugMapRenderer';
import {UnitInfoRenderer} from './UnitInfoRenderer';
import type {AnimationConfigEntry} from '@utils/animationConfig';
import {Tween, type TickerLike, runTickerTween, lerp} from '@utils/tween';

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
  private targetingRenderer = new TargetingRenderer();
  private entityRenderer = new EntityRenderer();
  private fogRenderer = new FogRenderer();
  private floatingTextRenderer = new FloatingTextRenderer();
  private debugMapRenderer = new DebugMapRenderer();
  public readonly unitInfoRenderer = new UnitInfoRenderer();

  private cameraAnimation: CameraAnimation | null = null;
  /** Базовая клетка камеры: начальная точка текущего/последнего движения игрока. */
  private cameraBase: Position | null = null;
  /** Текущая мировая позиция камеры (в пикселях тайлов), обновляется tween'ом. */
  private cameraWorldPos: { x: number; y: number } | null = null;
  private lastInput: RenderInput | null = null;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    // Порядок слоёв важен:
    // 1. тайлы пола
    // 2. debug-оверлей комнат и коридоров — под туманом, чтобы не мешал игре
    // 3. подсветка клеток (таргетинг) — под туманом, чтобы не светила в затемнённой зоне
    // 4. туман войны — затемняет пол, но не сущности
    // 5. сущности и предметы — рисуются поверх тумана, чтобы большие спрайты не обрезались
    // 6. превью интентов (стрелки, цифры урона) — поверх сущностей
    this.root.addChild(this.tileRenderer.container);
    this.root.addChild(this.debugMapRenderer.container);
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
   * - Вне анимации камера центрируется на cameraBase. Пока анимация движения
   *   игрока ещё не началась, cameraBase берётся из начальной клетки первого
   *   MOVE/JUMP в плане, чтобы не показывать игрока в конечной позиции раньше
   *   времени. После старта/завершения анимации база обновляется в animateCamera().
   */
  render(input: RenderInput): void {
    this.lastInput = input;

    const scale = input.zoom;
    const viewW = this.viewportWidth / scale;
    const viewH = this.viewportHeight / scale;

    let cameraX: number;
    let cameraY: number;

    this.root.scale.set(scale);

    if (this.cameraAnimation && this.cameraWorldPos) {
      // Пока активна камерная анимация, мировая позиция камеры управляется tween'ом.
      // render() только применяет текущий zoom к уже вычисленным мировым координатам.
      cameraX = this.cameraWorldPos.x;
      cameraY = this.cameraWorldPos.y;
      this.root.x = -cameraX * scale;
      this.root.y = -cameraY * scale;
    } else {
      // База камеры: если для игрока ещё не началась анимация движения в текущей партии,
      // берём начальную клетку из плана, чтобы не телепортировать камеру в конечную
      // позицию до старта анимации. После старта/завершения анимации база обновляется
      // в animateCamera().
      if (!input.animations) {
        this.cameraBase = null;
      } else if (this.cameraBase === null) {
        const plannedFrom = this.findPlayerMoveFrom(input);
        if (plannedFrom) {
          this.cameraBase = plannedFrom;
        }
      }

      const cameraBase = this.cameraBase ?? input.state.player;
      const playerScreenX = cameraBase.x * TILE_SIZE;
      const playerScreenY = cameraBase.y * TILE_SIZE;

      cameraX = playerScreenX + TILE_SIZE / 2 - viewW / 2;
      cameraY = playerScreenY + TILE_SIZE / 2 - viewH / 2;

      this.root.x = -cameraX * scale;
      this.root.y = -cameraY * scale;
      this.cameraWorldPos = { x: cameraX, y: cameraY };
    }

    this.tileRenderer.update(input, cameraX, cameraY, viewW, viewH);
    this.debugMapRenderer.update(input);
    this.targetingRenderer.update(input);
    this.entityRenderer.update(input);
    this.fogRenderer.update(input, cameraX, cameraY, viewW, viewH);
    this.unitInfoRenderer.update(input, (id) => this.entityRenderer.getSprite(id));

    this.syncTextLayer();
  }

  // ── Promise-based анимации ───────────────────────────────────────

  /** Анимировать прыжок сущности. */
  animateJump(entityId: string, from: Position, to: Position, config: AnimationConfigEntry): Promise<void> {
    const promises: Promise<void>[] = [
      this.entityRenderer.animateJump(entityId, from, to, config),
    ];

    if (entityId === this.lastInput?.state.player.id) {
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

  /** Анимировать дугу рассечения от кастера к нескольким клеткам.
   *  Рисует одну красную дугу, центр которой совпадает с клеткой кастующего.
   *  Дуга строится вокруг центральной клетки positions[1] и охватывает 90°.
   *  Быстро «взмахивает» и затухает.
   *  Использует runTickerTween, чтобы tween обновлялся через PixiJS ticker. */
  animateSlashArc(from: Position, positions: Position[], config: AnimationConfigEntry, ticker: TickerLike): Promise<void> {
    const centerX = from.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = from.y * TILE_SIZE + TILE_SIZE / 2;
    const radius = TILE_SIZE * Math.SQRT2;
    const color = 0xe74c3c;
    const lineWidth = TILE_SIZE / 3;

    const target = positions[1];
    if (!target) {
      return Promise.resolve();
    }

    const midAngle = Math.atan2(
      target.y * TILE_SIZE + TILE_SIZE / 2 - centerY,
      target.x * TILE_SIZE + TILE_SIZE / 2 - centerX,
    );
    const startAngle = midAngle - Math.PI / 4;
    const endAngle = midAngle + Math.PI / 4;

    const g = new Graphics();
    g.x = centerX;
    g.y = centerY;
    g.alpha = 0;
    this.root.addChild(g);

    return new Promise((resolve) => {
      runTickerTween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          let currentEndAngle: number;
          let alpha: number;

          if (p <= 0.5) {
            // Первая половина: дуга «разворачивается» от начального угла к конечному
            // и одновременно появляется из прозрачности.
            const t = p * 2;
            currentEndAngle = lerp(startAngle, endAngle, t);
            alpha = lerp(0, 0.9, t);
          } else {
            // Вторая половина: полная дуга быстро затухает.
            currentEndAngle = endAngle;
            const t = (p - 0.5) * 2;
            alpha = lerp(0.9, 0, t);
          }

          g.clear();
          g.arc(0, 0, radius, startAngle, currentEndAngle, false);
          g.stroke({ width: lineWidth, color });
          g.alpha = alpha;
        },
        onComplete: () => {
          g.destroy();
          resolve();
        },
      }, ticker);
    });
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

  /** Анимировать вспышку статус-эффекта: частицы, разлетающиеся от центра.
   *  Цвет зависит от типа статуса. */
  animateStatusBurst(center: Position, statusType: string, config: AnimationConfigEntry, ticker: TickerLike): Promise<void> {
    const colors: Record<string, number> = {
      burning: 0xff4400,
      poisoned: 0x44ff44,
      frozen: 0x88ddff,
      stunned: 0xffff00,
      regenerating: 0x44ff88,
      ticked: 0xffaa00,
    };
    const color = colors[statusType] ?? 0xffffff;
    const centerX = center.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = center.y * TILE_SIZE + TILE_SIZE / 2;
    const particleCount = 6;

    const particles = Array.from({ length: particleCount }, (_, i) => {
      const g = new Graphics();
      g.circle(0, 0, 3);
      g.fill({ color, alpha: 0.9 });
      g.x = centerX;
      g.y = centerY;
      this.root.addChild(g);

      const angle = (i / particleCount) * Math.PI * 2;
      const speed = TILE_SIZE * 0.3 + ((i % 3) * TILE_SIZE * 0.15);
      const targetX = centerX + Math.cos(angle) * speed;
      const targetY = centerY + Math.sin(angle) * speed;

      return { g, targetX, targetY };
    });

    return new Promise((resolve) => {
      runTickerTween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          for (const { g, targetX, targetY } of particles) {
            g.x = lerp(centerX, targetX, p);
            g.y = lerp(centerY, targetY, p);
            g.alpha = lerp(0.9, 0, p);
          }
        },
        onComplete: () => {
          for (const { g } of particles) {
            g.destroy();
          }
          resolve();
        },
      }, ticker);
    });
  }

  /** Преобразовать экранные координаты в координаты тайла мира.
   *  Использует текущую мировую позицию камеры, вычисленную в render(). */
  screenToWorld(screenX: number, screenY: number): Position {
    const input = this.lastInput;
    if (!input) return { x: 0, y: 0 };
    const scale = input.zoom;
    const cameraWorldPos = this.cameraWorldPos ?? this.computeCameraWorldPos(input);
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
    const base = this.cameraBase ?? input.state.player;
    return {
      x: base.x * TILE_SIZE + TILE_SIZE / 2 - viewW / 2,
      y: base.y * TILE_SIZE + TILE_SIZE / 2 - viewH / 2,
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

  /**
   * Ищет начальную клетку первой анимации MOVE игрока в запланированных анимациях.
   * Возвращает null, если такой анимации нет.
   */
  private findPlayerMoveFrom(input: RenderInput): Position | null {
    const playerId = input.state.player.id;
    const animations = input.animations;
    if (!animations) return null;

    for (const phase of animations) {
      for (const node of phase.nodes) {
        const from = this.findMoveFromInNode(node, playerId);
        if (from) return from;
      }
    }
    return null;
  }

  private findMoveFromInNode(node: import('@presentation/types').AnimationNode, playerId: string): Position | null {
    if ((node.step.type === 'MOVE' || node.step.type === 'JUMP') && node.step.entityId === playerId) {
      return node.step.from;
    }
    for (const child of node.children) {
      const from = this.findMoveFromInNode(child, playerId);
      if (from) return from;
    }
    return null;
  }

  /** Анимировать движение камеры между двумя тайлами. */
  animateCamera(fromTile: Position, toTile: Position, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      // Прерываем предыдущую камерную анимацию, чтобы старый onComplete не сбросил
      // новый tween и чтобы камера плавно продолжила движение от текущей позиции.
      if (this.cameraAnimation) {
        this.cameraAnimation.tween.cancel();
      }

      this.cameraBase = fromTile;

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

          this.cameraWorldPos = { x, y };
        },
        onComplete: () => {
          // Защита от устаревшего onComplete: старый tween мог быть отменён.
          if (this.cameraAnimation?.tween !== tween) return;
          this.cameraAnimation = null;
          this.cameraBase = toTile;
          const scale = this.root.scale.x || 1;
          const viewW = this.viewportWidth / scale;
          const viewH = this.viewportHeight / scale;
          this.cameraWorldPos = {
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
    this.unitInfoRenderer.updateAnimations(now);
    this.floatingTextRenderer.update(now);
    this.unitInfoRenderer.syncPositions((id) => this.entityRenderer.getSprite(id));
    this.updateCamera(now);
    this.syncTextLayer();
  };

  private updateCamera(now: number): void {
    if (!this.cameraAnimation || !this.cameraWorldPos) return;
    const finished = this.cameraAnimation.tween.update(now);
    if (finished) {
      this.cameraAnimation = null;
    }
    // Применяем текущий zoom к мировой позиции камеры. Это корректно обрабатывает
    // изменение масштаба во время движения камеры.
    const scale = this.root.scale.x || 1;
    this.root.x = -this.cameraWorldPos.x * scale;
    this.root.y = -this.cameraWorldPos.y * scale;
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
    const cameraWorldPos = this.cameraWorldPos ?? this.computeCameraWorldPos(this.lastInput);
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
    this.targetingRenderer.clear();
    this.entityRenderer.clear();
    this.fogRenderer.clear();
    this.floatingTextRenderer.clear();
    this.unitInfoRenderer.destroy();
    this.cameraAnimation = null;
    this.cameraBase = null;
    this.cameraWorldPos = null;
    this.lastInput = null;
    this.root.destroy({children: true});
    this.textLayer.destroy({children: true});
  }
}
