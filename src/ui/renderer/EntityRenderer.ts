/**
 * Рендерер сущностей: игрок + враги.
 *
 * Использует пул спрайтов по entityId.
 * Поддерживает Promise-based анимации передвижения, атаки и смерти.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {RenderInput, Position, AnimationNode} from '@presentation/types';
import type {DisplayState} from '@presentation/displayState/types';
import {TILE_SIZE, FOG_EXPLORED_SPRITE_ALPHA} from '@utils/constants';
import {getRenderScale} from '@presentation/renderScaleResolver';
import {getPlayerSprite, getEnemySprite, getStairsSprite, getItemSprite, getDoorSprite} from './spriteRegistry';
import {getTextureSync, getTexture} from './TextureCache';
import {Tween, Vec2Tween, lerp} from '@utils/tween';
import type {Animatable} from '@utils/tween';
import type {AnimationConfigEntry} from '@utils/animationConfig';

const ACTOR_ANCHOR_X = 0.5;
const ACTOR_ANCHOR_Y = 1;
const ACTOR_OFFSET_Y_FACTOR = 0.85; // низ спрайта на 15% выше низа тайла

type ActiveAnimation = {
  tween: Animatable;
  onComplete: () => void;
};

export class EntityRenderer {
  public readonly container = new Container();
  private sprites = new Map<string, Sprite>();
  private activeAnimations = new Map<string, ActiveAnimation>();

  constructor() {
    this.container.sortableChildren = true;
  }

  /** Получить спрайт сущности по id (используется внешними renderer'ами). */
  getSprite(id: string): Sprite | undefined {
    return this.sprites.get(id);
  }

  /** Синхронное обновление спрайтов на основе текущего DisplayState.
   *  Текстуры подгружаются фоново, если их ещё нет в кеше. */
  update(input: RenderInput): void {
    const displayState = input.displayState;
    const existingIds = new Set<string>();
    const texturePaths = new Map<string, string>();

    // Собираем ITEM_DROP-узлы: предмета ещё нет в DisplayState, но для анимации
    // появления нужно создать спрайт заранее и скрыть до её старта.
    const itemDropIds = new Set<string>();
    const itemDropNodes: Array<{ itemId: string; templateId: string; position: Position }> = [];
    if (input.animations) {
      for (const phase of input.animations) {
        for (const node of phase.nodes) {
          collectItemDropNodes(node, itemDropIds, itemDropNodes);
        }
      }
    }

    const playerPath = getPlayerSprite(displayState.player.templateId);
    texturePaths.set(playerPath, playerPath);

    // Игрок всегда виден себе
    const playerTexture = getTextureSync(playerPath);
    const playerScale = getRenderScale(displayState.player.templateId, true);
    this.renderEntitySync(displayState.player.id, displayState.player.x, displayState.player.y, playerTexture, playerPath, true, playerScale);
    const playerSprite = this.sprites.get(displayState.player.id);
    if (playerSprite) playerSprite.visible = true;
    existingIds.add(displayState.player.id);

    for (const entity of displayState.entities.values()) {
      if (entity.type === 'enemy') {
        // Не рендерим мёртвых врагов, даже если они ещё не удалены из DisplayState
        if (entity.isAlive === false) continue;
        const path = getEnemySprite(entity.templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const scale = getRenderScale(entity.templateId, true);
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, true, scale);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = input.debugEnabled || isCellVisible(displayState, entity.x, entity.y);
        }
        existingIds.add(entity.id);
      }
      if (entity.type === 'stairs') {
        const path = getStairsSprite(entity.templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const scale = getRenderScale(entity.templateId, false);
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, false, scale);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = input.debugEnabled || isCellExploredOrVisible(displayState, entity.x, entity.y);
          sprite.alpha = getStaticEntityAlpha(displayState, entity.x, entity.y, input.debugEnabled);
        }
        existingIds.add(entity.id);
      }
      if (entity.type === 'floor_item_container') {
        const templateId = entity.templateId;
        const path = getItemSprite(templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const scale = getRenderScale(templateId, false);
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, false, scale);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          // Если для предмета запланирована анимация появления — скрываем спрайт
          // до её начала. animateItemDrop сам установит visible = true.
          if (itemDropIds.has(entity.id)) {
            sprite.visible = false;
          } else {
            sprite.visible = input.debugEnabled || isCellExploredOrVisible(displayState, entity.x, entity.y);
            sprite.alpha = getStaticEntityAlpha(displayState, entity.x, entity.y, input.debugEnabled);
          }
        }
        existingIds.add(entity.id);
      }
      if (entity.type === 'door') {
        // Не рендерим разрушенные двери, даже если они ещё не удалены из DisplayState
        if (entity.isAlive === false) continue;
        const path = input.doorSprites.get(entity.id) ?? getDoorSprite(entity.templateId, entity.isOpen ?? false);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const scale = getRenderScale(entity.templateId, false);
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, false, scale);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = input.debugEnabled || isCellExploredOrVisible(displayState, entity.x, entity.y);
          sprite.alpha = getStaticEntityAlpha(displayState, entity.x, entity.y, input.debugEnabled);
        }
        existingIds.add(entity.id);
      }
    }

    // Предварительно создаём спрайты для предметов, которые появятся в анимации
    // ITEM_DROP, но ещё отсутствуют в DisplayState.
    for (const drop of itemDropNodes) {
      if (!existingIds.has(drop.itemId)) {
        const path = getItemSprite(drop.templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const scale = getRenderScale(drop.templateId, false);
        this.renderEntitySync(drop.itemId, drop.position.x, drop.position.y, texture, path, false, scale);
        const sprite = this.sprites.get(drop.itemId);
        if (sprite && !this.activeAnimations.has(drop.itemId)) {
          sprite.visible = false;
        }
        existingIds.add(drop.itemId);
      }
    }

    // Удаляем спрайты для исчезнувших сущностей, но не трогаем те,
    // для которых ещё идёт активная анимация (например, смерть или подбор предмета).
    for (const [id, sprite] of this.sprites) {
      if (!existingIds.has(id) && !this.activeAnimations.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
        this.activeAnimations.delete(id);
      }
    }
  }

  /** Анимация прыжка спрайта между тайлами.
   *
   * Фазы:
   * 1. Подготовка: сжатие по вертикали.
   * 2. Рывок/отрыв: резкое восстановление масштаба + начало полёта.
   * 3. Полёт: дугообразная траектория к цели.
   * 4. Приземление: сжатие от удара.
   * 5. Отскок: небольшое подпрыгивание на месте.
   */
  animateJump(entityId: string, from: Position, to: Position, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const sprite = this.sprites.get(entityId);
      if (!sprite) {
        resolve();
        return;
      }

      this.cancelAnimationFor(entityId);

      const isActor = sprite.anchor.x === ACTOR_ANCHOR_X && sprite.anchor.y === ACTOR_ANCHOR_Y;
      const offsetX = isActor ? TILE_SIZE / 2 : 0;
      const offsetY = isActor ? TILE_SIZE * ACTOR_OFFSET_Y_FACTOR : 0;

      sprite.visible = true;

      const fromX = from.x * TILE_SIZE + offsetX;
      const fromY = from.y * TILE_SIZE + offsetY;
      const toX = to.x * TILE_SIZE + offsetX;
      const toY = to.y * TILE_SIZE + offsetY;

      const baseScaleX = sprite.scale.x;
      const baseScaleY = sprite.scale.y;
      const jumpHeight = TILE_SIZE * 0.6;
      const anticipationSquash = 0.7;
      const launchStretch = 1.1;
      const landingSquash = 0.8;
      const recoveryStretch = 1.05;

      sprite.x = fromX;
      sprite.y = fromY;

      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          let x: number;
          let y: number;
          let scaleY = baseScaleY;
          let scaleX = baseScaleX;

          if (p < 0.15) {
            // Подготовка: сжатие.
            const t = p / 0.15;
            scaleY = lerp(baseScaleY, baseScaleY * anticipationSquash, t);
            scaleX = lerp(baseScaleX, baseScaleX * (1 + (1 - anticipationSquash) * 0.5), t);
            x = fromX;
            y = fromY + TILE_SIZE * 0.15 * t;
          } else if (p < 0.25) {
            // Рывок: резкое восстановление + старт полёта.
            const t = (p - 0.15) / 0.10;
            scaleY = lerp(baseScaleY * anticipationSquash, baseScaleY * launchStretch, t);
            scaleX = lerp(baseScaleX * (1 + (1 - anticipationSquash) * 0.5), baseScaleX * 0.95, t);
            const flightT = t * 0.2;
            x = lerp(fromX, toX, flightT);
            y = lerp(fromY, toY, flightT) - Math.sin(flightT * Math.PI) * jumpHeight * 0.2;
          } else if (p < 0.85) {
            // Полёт: дугообразная траектория.
            const t = (p - 0.25) / 0.60;
            scaleY = lerp(baseScaleY * launchStretch, baseScaleY, t);
            scaleX = lerp(baseScaleX * 0.95, baseScaleX, t);
            x = lerp(fromX, toX, 0.2 + t * 0.8);
            const arc = Math.sin(t * Math.PI);
            y = lerp(fromY, toY, 0.2 + t * 0.8) - arc * jumpHeight;
          } else if (p < 0.95) {
            // Приземление: сжатие от удара.
            const t = (p - 0.85) / 0.10;
            scaleY = lerp(baseScaleY, baseScaleY * landingSquash, t);
            scaleX = lerp(baseScaleX, baseScaleX * (1 + (1 - landingSquash) * 0.5), t);
            x = toX;
            y = toY;
          } else {
            // Отскок: подпрыгивание на месте.
            const t = (p - 0.95) / 0.05;
            const bounce = Math.sin(t * Math.PI);
            scaleY = lerp(baseScaleY * landingSquash, baseScaleY * recoveryStretch, bounce);
            scaleX = lerp(baseScaleX * (1 + (1 - landingSquash) * 0.5), baseScaleX, bounce);
            x = toX;
            y = toY - TILE_SIZE * 0.08 * Math.sin(t * Math.PI);
          }

          sprite.x = x;
          sprite.y = y;
          sprite.zIndex = y;
          sprite.scale.set(scaleX, scaleY);
        },
        onComplete: () => {
          sprite.x = toX;
          sprite.y = toY;
          sprite.scale.set(baseScaleX, baseScaleY);
          this.activeAnimations.delete(entityId);
          resolve();
        },
      });

      const anim: ActiveAnimation = { tween, onComplete: resolve };
      this.activeAnimations.set(entityId, anim);
      tween.start(performance.now());
    });
  }

  /** Анимация перемещения спрайта между тайлами. Возвращает Promise, резолвящийся по завершении. */
  animateMove(entityId: string, from: Position, to: Position, config: AnimationConfigEntry, sway: boolean = true): Promise<void> {
    return new Promise((resolve) => {
      const sprite = this.sprites.get(entityId);
      if (!sprite) {
        resolve();
        return;
      }

      this.cancelAnimationFor(entityId);

      const isActor = sprite.anchor.x === ACTOR_ANCHOR_X && sprite.anchor.y === ACTOR_ANCHOR_Y;
      const offsetX = isActor ? TILE_SIZE / 2 : 0;
      const offsetY = isActor ? TILE_SIZE * ACTOR_OFFSET_Y_FACTOR : 0;

      sprite.visible = true;
      sprite.x = from.x * TILE_SIZE + offsetX;
      sprite.y = from.y * TILE_SIZE + offsetY;

      const swayCycles = 1;
      const swayAmplitude = 0.08;
      const shouldSway = sway && isActor;

      const tween = new Vec2Tween({
        from: { x: from.x * TILE_SIZE + offsetX, y: from.y * TILE_SIZE + offsetY },
        to: { x: to.x * TILE_SIZE + offsetX, y: to.y * TILE_SIZE + offsetY },
        duration: config.duration,
        easing: config.easing,
        onUpdate: (x, y, progress) => {
          sprite.x = x;
          sprite.y = y;
          sprite.zIndex = y;
          if (shouldSway) {
            sprite.rotation = Math.sin(progress * Math.PI * 2 * swayCycles) * swayAmplitude;
          }
        },
        onComplete: () => {
          if (shouldSway) {
            sprite.rotation = 0;
          }
          this.activeAnimations.delete(entityId);
          resolve();
        },
      });

      const anim: ActiveAnimation = { tween, onComplete: resolve };
      this.activeAnimations.set(entityId, anim);
      tween.start(performance.now());
    });
  }

  /** Анимация атаки: сдвиг спрайта в направлении цели и возврат. */
  animateAttack(entityId: string, dx: number, dy: number, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const sprite = this.sprites.get(entityId);
      if (!sprite) {
        resolve();
        return;
      }

      const startX = sprite.x;
      const startY = sprite.y;
      const offsetX = dx * TILE_SIZE * 0.4;
      const offsetY = dy * TILE_SIZE * 0.4;

      this.cancelAnimationFor(entityId);

      sprite.visible = true;

      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          const t = p < 0.5 ? p * 2 : (1 - p) * 2;
          sprite.x = startX + offsetX * t;
          sprite.y = startY + offsetY * t;
          sprite.zIndex = sprite.y;
        },
        onComplete: () => {
          sprite.x = startX;
          sprite.y = startY;
          this.activeAnimations.delete(entityId);
          resolve();
        },
      });

      const anim: ActiveAnimation = { tween, onComplete: resolve };
      this.activeAnimations.set(entityId, anim);
      tween.start(performance.now());
    });
  }

  /** Анимация каста способности: пульсация спрайта (scale up → down). */
  animateCast(entityId: string, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const sprite = this.sprites.get(entityId);
      if (!sprite) {
        resolve();
        return;
      }

      this.cancelAnimationFor(entityId);

      sprite.visible = true;

      const startScale = sprite.scale.x;
      const peakScale = startScale * 1.3;

      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          // Подъём до 0.5, затем спуск
          const t = p < 0.5 ? p * 2 : (1 - p) * 2;
          const s = lerp(startScale, peakScale, t);
          sprite.scale.set(s);
        },
        onComplete: () => {
          sprite.scale.set(startScale);
          this.activeAnimations.delete(entityId);
          resolve();
        },
      });

      const anim: ActiveAnimation = { tween, onComplete: resolve };
      this.activeAnimations.set(entityId, anim);
      tween.start(performance.now());
    });
  }

  /** Анимация появления предмета: перелёт от from к to + fade-in + scale-up. */
  animateItemDrop(entityId: string, from: Position, to: Position, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const sprite = this.sprites.get(entityId);
      if (!sprite) {
        resolve();
        return;
      }

      this.cancelAnimationFor(entityId);

      sprite.visible = true;

      const startAlpha = 0;
      const endAlpha = 1;
      const startScale = sprite.scale.x * 0.5;
      const endScale = sprite.scale.x;

      const fromX = from.x * TILE_SIZE;
      const fromY = from.y * TILE_SIZE;
      const toX = to.x * TILE_SIZE;
      const toY = to.y * TILE_SIZE;

      sprite.x = fromX;
      sprite.y = fromY;
      sprite.alpha = startAlpha;
      sprite.scale.set(startScale);

      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          sprite.x = lerp(fromX, toX, p);
          sprite.y = lerp(fromY, toY, p);
          sprite.alpha = lerp(startAlpha, endAlpha, p);
          const s = lerp(startScale, endScale, p);
          sprite.scale.set(s);
        },
        onComplete: () => {
          sprite.x = toX;
          sprite.y = toY;
          sprite.alpha = endAlpha;
          sprite.scale.set(endScale);
          this.activeAnimations.delete(entityId);
          resolve();
        },
      });

      const anim: ActiveAnimation = { tween, onComplete: resolve };
      this.activeAnimations.set(entityId, anim);
      tween.start(performance.now());
    });
  }

  /** Анимация отскока при столкновении: короткий сдвиг в сторону препятствия и обратно. */
  animateBounce(entityId: string, _x: number, _y: number, dx: number, dy: number, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const sprite = this.sprites.get(entityId);
      if (!sprite) {
        resolve();
        return;
      }

      this.cancelAnimationFor(entityId);

      sprite.visible = true;

      const startX = sprite.x;
      const startY = sprite.y;
      const offsetX = dx * TILE_SIZE * 0.25;
      const offsetY = dy * TILE_SIZE * 0.25;

      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          const t = p < 0.5 ? p * 2 : (1 - p) * 2;
          sprite.x = startX + offsetX * t;
          sprite.y = startY + offsetY * t;
          sprite.zIndex = sprite.y;
        },
        onComplete: () => {
          sprite.x = startX;
          sprite.y = startY;
          this.activeAnimations.delete(entityId);
          resolve();
        },
      });

      const anim: ActiveAnimation = { tween, onComplete: resolve };
      this.activeAnimations.set(entityId, anim);
      tween.start(performance.now());
    });
  }

  /** Анимация смерти: fade-out + scale-down. Удаляет спрайт по завершении. */
  animateDeath(entityId: string, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const sprite = this.sprites.get(entityId);
      if (!sprite) {
        resolve();
        return;
      }

      this.cancelAnimationFor(entityId);

      sprite.visible = true;

      const startAlpha = sprite.alpha;
      const startScale = sprite.scale.x;

      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          sprite.alpha = lerp(startAlpha, 0, p);
          const s = lerp(startScale, 0, p);
          sprite.scale.set(s);
        },
        onComplete: () => {
          sprite.destroy();
          this.sprites.delete(entityId);
          this.activeAnimations.delete(entityId);
          resolve();
        },
      });

      const anim: ActiveAnimation = { tween, onComplete: resolve };
      this.activeAnimations.set(entityId, anim);
      tween.start(performance.now());
    });
  }

  /** Обновить позиции спрайтов по активным анимациям. Вызывается из ticker. */
  updateAnimations(now: number): void {
    const completed: string[] = [];
    for (const [entityId, anim] of this.activeAnimations) {
      const finished = anim.tween.update(now);
      if (finished) {
        completed.push(entityId);
      }
    }
    for (const entityId of completed) {
      const anim = this.activeAnimations.get(entityId);
      if (anim) {
        this.activeAnimations.delete(entityId);
        anim.onComplete();
      }
    }
  }

  /** Есть ли незавершённые анимации. */
  hasActiveAnimations(): boolean {
    return this.activeAnimations.size > 0;
  }

  /** Прервать все текущие анимации и резолвить их Promise'ы. */
  clearAnimations(): void {
    for (const anim of this.activeAnimations.values()) {
      anim.tween.cancel();
      anim.onComplete();
    }
    this.activeAnimations.clear();
  }

  clear(): void {
    this.clearAnimations();
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.container.removeChildren();
  }

  private cancelAnimationFor(entityId: string): void {
    const prev = this.activeAnimations.get(entityId);
    if (prev) {
      prev.tween.cancel();
      prev.onComplete();
      this.activeAnimations.delete(entityId);
    }
  }

  private renderEntitySync(
    id: string,
    x: number,
    y: number,
    texture: Texture | undefined,
    path: string,
    isActor: boolean = false,
    renderScale: number = 1.0,
  ): void {
    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = new Sprite(texture ?? Texture.EMPTY);
      this.sprites.set(id, sprite);
      this.container.addChild(sprite);
      if (isActor) {
        sprite.anchor.set(ACTOR_ANCHOR_X, ACTOR_ANCHOR_Y);
      }
      const size = TILE_SIZE * renderScale;
      if (texture && texture !== Texture.EMPTY) {
        sprite.width = size;
        sprite.height = size;
      }
    } else if (texture && sprite.texture !== texture) {
      sprite.texture = texture;
      const size = TILE_SIZE * renderScale;
      sprite.width = size;
      sprite.height = size;
    }

    if (!texture) {
      // Фоновая подгрузка текстуры, если её ещё нет в кеше
      getTexture(path)
        .then((loaded) => {
          const s = this.sprites.get(id);
          if (s) {
            s.texture = loaded;
            const size = TILE_SIZE * renderScale;
            s.width = size;
            s.height = size;
          }
        })
        .catch(() => {});
    }

    // Не трогаем позицию, если идёт активная анимация.
    // DisplayState уже отражает текущее состояние, а tween управляет спрайтом напрямую.
    if (!this.activeAnimations.has(id)) {
      if (isActor) {
        sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = y * TILE_SIZE + TILE_SIZE * ACTOR_OFFSET_Y_FACTOR;
      } else {
        sprite.x = x * TILE_SIZE;
        sprite.y = y * TILE_SIZE;
      }
      sprite.zIndex = sprite.y;
    }
  }

}

function isCellVisible(displayState: DisplayState, x: number, y: number): boolean {
  return displayState.map.visible[y]?.[x] ?? false;
}

function isCellExploredOrVisible(displayState: DisplayState, x: number, y: number): boolean {
  return (displayState.map.visible[y]?.[x] ?? false) || (displayState.map.explored[y]?.[x] ?? false);
}

/** Альфа для статических сущностей (предметы, двери, лестницы).
 *  На explored клетках спрайт затемняется, чтобы визуально совпадало с туманом,
 *  который теперь рисуется под сущностями. */
function getStaticEntityAlpha(displayState: DisplayState, x: number, y: number, debugEnabled: boolean): number {
  if (debugEnabled) return 1;
  if (isCellVisible(displayState, x, y)) return 1;
  if (isCellExploredOrVisible(displayState, x, y)) return FOG_EXPLORED_SPRITE_ALPHA;
  return 1; // спрайт будет скрыт через visible = false
}

/** Рекурсивно собирает ITEM_DROP-узлы для предварительного создания спрайтов. */
function collectItemDropNodes(
  node: AnimationNode,
  ids: Set<string>,
  out: Array<{ itemId: string; templateId: string; position: Position }>,
): void {
  if (node.step.type === 'ITEM_DROP') {
    ids.add(node.step.itemId);
    out.push({ itemId: node.step.itemId, templateId: node.step.templateId, position: node.step.position });
  }
  for (const child of node.children) {
    collectItemDropNodes(child, ids, out);
  }
}


