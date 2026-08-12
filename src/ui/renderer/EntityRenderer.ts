/**
 * Рендерер сущностей: игрок + враги.
 *
 * Использует пул спрайтов по entityId.
 * Поддерживает Promise-based анимации передвижения, атаки и смерти.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {AnimationNode, Position, RenderInput} from '@presentation/types';
import type {DisplayState} from '@presentation/displayState/types';
import {FOG_EXPLORED_SPRITE_ALPHA, TILE_HEIGHT, TILE_SIZE} from '@utils/constants';
import type {ResolvedSpritePlacement} from '@presentation/spritePlacementResolver';
import {getSpritePlacement} from '@presentation/spritePlacementResolver';
import {applyPlacement, placementAnchorPoint, placementSize, type ScreenPoint} from './spritePlacement';
import {getDoorSprite, getEnemySprite, getItemSprite, getPlayerSprite, getPoiSprite, getPropSprite, getStairsSprite, getTrapSprite} from './spriteRegistry';
import {getTexture, getTextureSync} from './TextureCache';
import {resolveEntityFrameSprite} from '@utils/assetResolver';
import {clearStickerTextures, getStickerTexture} from './stickerComposer';
import type {FactionId} from '@presentation/types';
import type {Animatable} from '@utils/tween';
import {lerp, Tween, Vec2Tween} from '@utils/tween';
import type {AnimationConfigEntry} from '@utils/animationConfig';

type ActiveAnimation = {
  tween: Animatable;
  onComplete: () => void;
};

export class EntityRenderer {
  public readonly container = new Container();
  private sprites = new Map<string, Sprite>();
  private activeAnimations = new Map<string, ActiveAnimation>();
  private stickerTextures = new Map<string, Texture>();
  private stickerKeys = new Map<string, string>();
  private stickerPending = new Map<string, Promise<void>>();
  /** Размещение спрайтов по entityId (актуализируется при каждом update, нужно анимациям). */
  private placements = new Map<string, { placement: ResolvedSpritePlacement; isActor: boolean }>();

  constructor() {
    this.container.sortableChildren = true;
  }

  /** Получить спрайт сущности по id (используется внешними renderer'ами). */
  getSprite(id: string): Sprite | undefined {
    return this.sprites.get(id);
  }

  /**
   * Текущий визуальный центр клетки сущности в мировых координатах.
   * В отличие от логической позиции учитывает идущую анимацию перемещения:
   * текущая позиция спрайта (его опорная точка) переводится в центр сжатой
   * клетки — смещение «опорная точка → центр» постоянно для любой клетки.
   */
  getVisualCenter(id: string): ScreenPoint | undefined {
    const sprite = this.sprites.get(id);
    if (!sprite) return undefined;
    const placement = this.placements.get(id)?.placement ?? getSpritePlacement(undefined, 'actor');
    const offsetX = TILE_SIZE * (placement.anchorX - 0.5);
    // Для «стоячих» спрайтов опорная точка — низ спрайта (anchorY),
    // для сплющенных (flattenY) — верх спрайта, лежащего на сжатой сетке.
    const offsetY = placement.flattenY
      ? -TILE_HEIGHT / 2
      : TILE_HEIGHT * (placement.anchorY - 0.5);
    return { x: sprite.x - offsetX, y: sprite.y - offsetY };
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
    const playerPlacement = getSpritePlacement(displayState.player.templateId, 'actor');
    const playerStickerTexture = this.stickerTextures.get(displayState.player.id);
    this.renderEntitySync(displayState.player.id, displayState.player.x, displayState.player.y, playerStickerTexture ?? playerTexture, playerPath, playerPlacement, true);
    this.updateSticker(displayState.player.id, playerPath, displayState.player.factionId ?? 'player', displayState.player.hp, displayState.player.maxHp, playerPlacement.scale);
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
        const placement = getSpritePlacement(entity.templateId, 'actor');
        const stickerTexture = this.stickerTextures.get(entity.id);
        this.renderEntitySync(entity.id, entity.x, entity.y, stickerTexture ?? texture, path, placement, true);
        this.updateSticker(entity.id, path, entity.factionId ?? 'enemies', entity.hp, entity.maxHp, placement.scale);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = input.debugEnabled || isCellVisible(displayState, entity.x, entity.y);
        }
        existingIds.add(entity.id);
      }
      if (entity.type === 'stairs') {
        const path = input.objectSprites.get(entity.id) ?? getStairsSprite(entity.templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const placement = getSpritePlacement(entity.templateId, 'object');
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, placement);
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
        const placement = getSpritePlacement(templateId, 'object');
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, placement);
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
        const path = input.objectSprites.get(entity.id) ?? getDoorSprite(entity.templateId, entity.isOpen ?? false);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const placement = getSpritePlacement(entity.templateId, 'object');
        const stickerTexture = this.stickerTextures.get(entity.id);
        this.renderEntitySync(entity.id, entity.x, entity.y, stickerTexture ?? texture, path, placement);
        this.updateSticker(entity.id, path, 'neutrals', entity.hp, entity.maxHp, placement.scale);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = input.debugEnabled || isCellExploredOrVisible(displayState, entity.x, entity.y);
          sprite.alpha = getStaticEntityAlpha(displayState, entity.x, entity.y, input.debugEnabled);
        }
        existingIds.add(entity.id);
      }
      if (entity.type === 'prop') {
        // Не рендерим разрушенные пропы, даже если они ещё не удалены из DisplayState
        if (entity.isAlive === false) continue;
        const path = input.objectSprites.get(entity.id) ?? getPropSprite(entity.templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const placement = getSpritePlacement(entity.templateId, 'object');
        const stickerTexture = this.stickerTextures.get(entity.id);
        this.renderEntitySync(entity.id, entity.x, entity.y, stickerTexture ?? texture, path, placement);
        this.updateSticker(entity.id, path, 'neutrals', entity.hp, entity.maxHp, placement.scale);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = input.debugEnabled || isCellExploredOrVisible(displayState, entity.x, entity.y);
          sprite.alpha = getStaticEntityAlpha(displayState, entity.x, entity.y, input.debugEnabled);
        }
        existingIds.add(entity.id);
      }
      if (entity.type === 'poi') {
        // poi неразрушаемы (нет hp/isAlive), рендерятся как статические объекты
        const path = input.objectSprites.get(entity.id) ?? getPoiSprite(entity.templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const placement = getSpritePlacement(entity.templateId, 'object');
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, placement);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = input.debugEnabled || isCellExploredOrVisible(displayState, entity.x, entity.y);
          sprite.alpha = getStaticEntityAlpha(displayState, entity.x, entity.y, input.debugEnabled);
        }
        existingIds.add(entity.id);
      }
      if (entity.type === 'trap') {
        // Скрытая ловушка не рисуется вне debug-режима.
        if (entity.hidden && !input.debugEnabled) continue;
        const path = input.objectSprites.get(entity.id) ?? getTrapSprite(entity.templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        const placement = getSpritePlacement(entity.templateId, 'trap');
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, placement);
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
        const placement = getSpritePlacement(drop.templateId, 'object');
        this.renderEntitySync(drop.itemId, drop.position.x, drop.position.y, texture, path, placement);
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
        this.placements.delete(id);
      }
    }

    // Очищаем sticker-состояние для исчезнувших сущностей.
    for (const id of this.stickerTextures.keys()) {
      if (!existingIds.has(id)) this.stickerTextures.delete(id);
    }
    for (const id of this.stickerKeys.keys()) {
      if (!existingIds.has(id)) this.stickerKeys.delete(id);
    }
    for (const id of this.stickerPending.keys()) {
      if (!existingIds.has(id)) this.stickerPending.delete(id);
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

      const placement = this.placements.get(entityId)?.placement
        ?? getSpritePlacement(undefined, 'actor');

      sprite.visible = true;

      const {x: fromX, y: fromY} = placementAnchorPoint(from.x, from.y, placement);
      const {x: toX, y: toY} = placementAnchorPoint(to.x, to.y, placement);

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
          let scaleY: number;
          let scaleX: number;

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

      const entry = this.placements.get(entityId);
      const placement = entry?.placement ?? getSpritePlacement(undefined, 'actor');
      // Покачивание — только у акторов (по категории, зафиксированной при рендере).
      const isActor = entry?.isActor ?? true;

      sprite.visible = true;
      const fromPoint = placementAnchorPoint(from.x, from.y, placement);
      const toPoint = placementAnchorPoint(to.x, to.y, placement);
      sprite.x = fromPoint.x;
      sprite.y = fromPoint.y;

      const swayCycles = 1;
      const swayAmplitude = 0.08;
      const shouldSway = sway && isActor;

      const tween = new Vec2Tween({
        from: fromPoint,
        to: toPoint,
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
      const offsetY = dy * TILE_HEIGHT * 0.4;

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

      // Предмет — «стоячий» объект: летит между опорными точками клеток.
      const placement = this.placements.get(entityId)?.placement
        ?? getSpritePlacement(undefined, 'object');
      const {x: fromX, y: fromY} = placementAnchorPoint(from.x, from.y, placement);
      const {x: toX, y: toY} = placementAnchorPoint(to.x, to.y, placement);

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
      const offsetY = dy * TILE_HEIGHT * 0.25;

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
          this.placements.delete(entityId);
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
    this.placements.clear();
    this.stickerTextures.clear();
    this.stickerKeys.clear();
    this.stickerPending.clear();
    clearStickerTextures();
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
    placement: ResolvedSpritePlacement,
    isActor: boolean = false,
  ): void {
    const {width, height} = placementSize(placement);

    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = new Sprite(texture ?? Texture.EMPTY);
      this.sprites.set(id, sprite);
      this.container.addChild(sprite);
      if (texture && texture !== Texture.EMPTY) {
        sprite.width = width;
        sprite.height = height;
      }
    } else if (texture && sprite.texture !== texture) {
      sprite.texture = texture;
      sprite.width = width;
      sprite.height = height;
    }

    if (!texture) {
      // Фоновая подгрузка текстуры, если её ещё нет в кеше
      getTexture(path)
        .then((loaded) => {
          const s = this.sprites.get(id);
          if (s) {
            s.texture = loaded;
            s.width = width;
            s.height = height;
          }
        })
        .catch(() => {});
    }

    this.placements.set(id, {placement, isActor});

    // Не трогаем позицию, если идёт активная анимация.
    // DisplayState уже отражает текущее состояние, а tween управляет спрайтом напрямую.
    if (!this.activeAnimations.has(id)) {
      const anchor = applyPlacement(sprite, x, y, placement);
      sprite.zIndex = anchor.y;
    }
  }

  private updateSticker(
    id: string,
    basePath: string,
    factionId: FactionId,
    hp: number | undefined,
    maxHp: number | undefined,
    scale: number,
  ): void {
    if (hp === undefined || maxHp === undefined || maxHp <= 0) return;

    const framePath = resolveEntityFrameSprite(basePath);
    if (!framePath) return;

    const key = `${basePath}|${framePath}|${factionId}|${hp}|${maxHp}`;
    if (this.stickerKeys.get(id) === key) return;
    if (this.stickerPending.has(id)) return;

    const hpRatio = hp / maxHp;
    const request = getStickerTexture(basePath, framePath, factionId, hpRatio)
      .then((texture) => {
        if (!texture) return;
        this.stickerTextures.set(id, texture);
        this.stickerKeys.set(id, key);
        const sprite = this.sprites.get(id);
        if (sprite && !sprite.destroyed) {
          sprite.texture = texture;
          const size = TILE_SIZE * scale;
          sprite.width = size;
          sprite.height = size;
        }
      })
      .catch(() => {})
      .finally(() => {
        this.stickerPending.delete(id);
      });

    this.stickerPending.set(id, request);
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


