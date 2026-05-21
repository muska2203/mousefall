/**
 * Рендерер сущностей: игрок + враги.
 *
 * Использует пул спрайтов по entityId.
 * Поддерживает Promise-based анимации передвижения, атаки и смерти.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {RenderInput, Position} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {getPlayerSprite, getEnemySprite, getStairsSprite} from './spriteRegistry';
import {getTextureSync, getTexture} from './TextureCache';
import {Tween, Vec2Tween, lerp} from '@utils/tween';
import type {Animatable} from '@utils/tween';
import type {AnimationConfigEntry} from '@utils/animationConfig';

type ActiveAnimation = {
  tween: Animatable;
  onComplete: () => void;
};

export class EntityRenderer {
  public readonly container = new Container();
  private sprites = new Map<string, Sprite>();
  private activeAnimations = new Map<string, ActiveAnimation>();

  /** Синхронное обновление спрайтов на основе текущего состояния.
   *  Текстуры подгружаются фоново, если их ещё нет в кеше. */
  update(input: RenderInput): void {
    const state = input.state;
    const visibleIds = new Set<string>();
    const texturePaths = new Map<string, string>();

    const playerPath = getPlayerSprite(input.portraitId);
    texturePaths.set(playerPath, playerPath);
    visibleIds.add(state.player.id);

    for (const entity of state.entities.values()) {
      if (entity.type === 'enemy') {
        const path = getEnemySprite(entity.templateId);
        texturePaths.set(path, path);
        visibleIds.add(entity.id);
      }
      if (entity.type === 'stairs') {
        const path = getStairsSprite(entity.direction);
        texturePaths.set(path, path);
        visibleIds.add(entity.id);
      }
    }

    const playerTexture = getTextureSync(playerPath);
    this.renderEntitySync(state.player.id, state.player.x, state.player.y, playerTexture, playerPath);

    for (const entity of state.entities.values()) {
      if (entity.type === 'enemy') {
        const path = getEnemySprite(entity.templateId);
        const texture = getTextureSync(path);
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path);
      }
      if (entity.type === 'stairs') {
        const path = getStairsSprite(entity.direction);
        const texture = getTextureSync(path);
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path);
      }
    }

    // Удаляем спрайты для исчезнувших сущностей
    for (const [id, sprite] of this.sprites) {
      if (!visibleIds.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
        this.activeAnimations.delete(id);
      }
    }
  }

  /** Анимация перемещения спрайта между тайлами. Возвращает Promise, резолвящийся по завершении. */
  animateMove(entityId: string, from: Position, to: Position, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const sprite = this.sprites.get(entityId);
      if (!sprite) {
        resolve();
        return;
      }

      this.cancelAnimationFor(entityId);

      sprite.x = from.x * TILE_SIZE;
      sprite.y = from.y * TILE_SIZE;

      const tween = new Vec2Tween({
        from: { x: from.x * TILE_SIZE, y: from.y * TILE_SIZE },
        to: { x: to.x * TILE_SIZE, y: to.y * TILE_SIZE },
        duration: config.duration,
        easing: config.easing,
        onUpdate: (x, y) => {
          sprite.x = x;
          sprite.y = y;
        },
        onComplete: () => {
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

      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          const t = p < 0.5 ? p * 2 : (1 - p) * 2;
          sprite.x = startX + offsetX * t;
          sprite.y = startY + offsetY * t;
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
    for (const [entityId, anim] of this.activeAnimations) {
      const finished = anim.tween.update(now);
      if (finished) {
        this.activeAnimations.delete(entityId);
        anim.onComplete();
      }
    }
  }

  /** Есть ли незавершённые анимации. */
  hasActiveAnimations(): boolean {
    return this.activeAnimations.size > 0;
  }

  /** Прервать все текущие анимации. */
  clearAnimations(): void {
    for (const anim of this.activeAnimations.values()) {
      anim.tween.cancel();
    }
    this.activeAnimations.clear();
  }

  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.activeAnimations.clear();
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

  private renderEntitySync(id: string, x: number, y: number, texture: Texture | undefined, path: string): void {
    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = new Sprite(texture ?? Texture.EMPTY);
      this.sprites.set(id, sprite);
      this.container.addChild(sprite);
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;
    } else if (texture && sprite.texture !== texture) {
      sprite.texture = texture;
    }

    if (!texture) {
      // Фоновая подгрузка текстуры, если её ещё нет в кеше
      getTexture(path)
        .then((loaded) => {
          const s = this.sprites.get(id);
          if (s) s.texture = loaded;
        })
        .catch(() => {});
    }

    // Не трогаем позицию, если идёт анимация
    if (!this.activeAnimations.has(id)) {
      sprite.x = x * TILE_SIZE;
      sprite.y = y * TILE_SIZE;
    }
    sprite.visible = true;
  }
}
