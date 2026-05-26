/**
 * Рендерер сущностей: игрок + враги.
 *
 * Использует пул спрайтов по entityId.
 * Поддерживает Promise-based анимации передвижения, атаки и смерти.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {RenderInput, Position, AnimationNode} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {getPlayerSprite, getEnemySprite, getStairsSprite, getItemSprite} from './spriteRegistry';
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

  /** Синхронное обновление спрайтов на основе текущего состояния.
   *  Текстуры подгружаются фоново, если их ещё нет в кеше. */
  update(input: RenderInput): void {
    const state = input.state;
    const existingIds = new Set<string>();
    const texturePaths = new Map<string, string>();

    // Собираем ID сущностей, для которых запланированы анимации.
    // Не обновляем их позицию и не удаляем спрайт до завершения анимации,
    // чтобы избежать мигания в конечной позиции или преждевременного исчезновения.
    const animatedIds = new Set<string>();
    if (input.animations) {
      for (const phase of input.animations) {
        for (const node of phase) {
          collectAnimatedEntityIds(node, animatedIds);
        }
      }
    }

    const playerPath = getPlayerSprite(input.portraitId);
    texturePaths.set(playerPath, playerPath);

    // Игрок всегда виден себе
    const playerTexture = getTextureSync(playerPath);
    this.renderEntitySync(state.player.id, state.player.x, state.player.y, playerTexture, playerPath, animatedIds, true);
    const playerSprite = this.sprites.get(state.player.id);
    if (playerSprite) playerSprite.visible = true;
    existingIds.add(state.player.id);

    for (const entity of state.entities.values()) {
      if (entity.type === 'enemy') {
        const path = getEnemySprite(entity.templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, animatedIds, true);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = isCellVisible(state, entity.x, entity.y);
        }
        existingIds.add(entity.id);
      }
      if (entity.type === 'stairs') {
        const path = getStairsSprite(entity.direction);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, animatedIds, false);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = isCellExploredOrVisible(state, entity.x, entity.y);
        }
        existingIds.add(entity.id);
      }
      if (entity.type === 'item') {
        const path = getItemSprite(entity.templateId);
        texturePaths.set(path, path);
        const texture = getTextureSync(path);
        this.renderEntitySync(entity.id, entity.x, entity.y, texture, path, animatedIds, false);
        const sprite = this.sprites.get(entity.id);
        if (sprite && !this.activeAnimations.has(entity.id)) {
          sprite.visible = isCellExploredOrVisible(state, entity.x, entity.y);
        }
        existingIds.add(entity.id);
      }
    }

    // Удаляем спрайты для исчезнувших сущностей
    for (const [id, sprite] of this.sprites) {
      if (!existingIds.has(id) && !animatedIds.has(id)) {
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

      const isActor = sprite.anchor.x === ACTOR_ANCHOR_X && sprite.anchor.y === ACTOR_ANCHOR_Y;
      const offsetX = isActor ? TILE_SIZE / 2 : 0;
      const offsetY = isActor ? TILE_SIZE * ACTOR_OFFSET_Y_FACTOR : 0;

      sprite.visible = true;
      sprite.x = from.x * TILE_SIZE + offsetX;
      sprite.y = from.y * TILE_SIZE + offsetY;

      const swayCycles = 1;
      const swayAmplitude = 0.08;

      const tween = new Vec2Tween({
        from: { x: from.x * TILE_SIZE + offsetX, y: from.y * TILE_SIZE + offsetY },
        to: { x: to.x * TILE_SIZE + offsetX, y: to.y * TILE_SIZE + offsetY },
        duration: config.duration,
        easing: config.easing,
        onUpdate: (x, y, progress) => {
          sprite.x = x;
          sprite.y = y;
          sprite.zIndex = y;
          if (isActor) {
            sprite.rotation = Math.sin(progress * Math.PI * 2 * swayCycles) * swayAmplitude;
          }
        },
        onComplete: () => {
          if (isActor) {
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
    animatedIds: Set<string>,
    isActor: boolean = false,
  ): void {
    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = new Sprite(texture ?? Texture.EMPTY);
      this.sprites.set(id, sprite);
      this.container.addChild(sprite);
      if (isActor) {
        sprite.anchor.set(ACTOR_ANCHOR_X, ACTOR_ANCHOR_Y);
        if (texture && texture !== Texture.EMPTY) {
          sprite.width = TILE_SIZE * 1.5;
          sprite.height = TILE_SIZE * 1.5;
        }
      } else {
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;
      }
    } else if (texture && sprite.texture !== texture) {
      sprite.texture = texture;
      if (isActor) {
        sprite.width = TILE_SIZE * 1.5;
        sprite.height = TILE_SIZE * 1.5;
      }
    }

    if (!texture) {
      // Фоновая подгрузка текстуры, если её ещё нет в кеше
      getTexture(path)
        .then((loaded) => {
          const s = this.sprites.get(id);
          if (s) {
            s.texture = loaded;
            if (isActor) {
              s.width = TILE_SIZE * 1.5;
              s.height = TILE_SIZE * 1.5;
            }
          }
        })
        .catch(() => {});
    }

    // Не трогаем позицию, если идёт активная анимация или запланирована новая
    if (!this.activeAnimations.has(id) && !animatedIds.has(id)) {
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

function isCellVisible(state: RenderInput['state'], x: number, y: number): boolean {
  return state.visible[y]?.[x] ?? false;
}

function isCellExploredOrVisible(state: RenderInput['state'], x: number, y: number): boolean {
  return (state.visible[y]?.[x] ?? false) || (state.explored[y]?.[x] ?? false);
}

/** Рекурсивно собирает entityId из деревьев анимаций, для которых запланированы анимации спрайтов. */
function collectAnimatedEntityIds(node: AnimationNode, out: Set<string>): void {
  switch (node.step.type) {
    case 'MOVE':
      out.add(node.step.entityId);
      break;
    case 'ATTACK':
      out.add(node.step.attackerId);
      break;
    case 'DEATH':
      out.add(node.step.entityId);
      break;
    case 'ABILITY_CAST':
      out.add(node.step.entityId);
      break;
  }
  for (const child of node.children) {
    collectAnimatedEntityIds(child, out);
  }
}
