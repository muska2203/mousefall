/**
 * Рендерер спрайтов статусов тайловых эффектов.
 *
 * Спрайты добавляются в тот же контейнер, что и акторы, чтобы участвовать
 * в общей Y-сортировке. Статус горения (`burning`) рисуется не одной
 * иконкой, а кластером из нескольких маленьких язычков пламени.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {RenderInput} from '@presentation/types';
import type {TileEffectOverlay} from '@presentation/displayState/types';
import {
  TILE_SIZE,
  TILE_EFFECT_STATUS_OFFSET_Y_FACTOR,
  TILE_EFFECT_STATUS_SPRITE_SCALE,
} from '@utils/constants';
import {getTileEffectSprite} from './spriteRegistry';
import {getTexture, getTextureSync} from './TextureCache';

/** Статусы, которые отрисовываются кластером мелких спрайтов. */
const CLUSTER_STATUS_TYPES = new Set(['burning']);

/** Минимальное количество спрайтов в кластере горения. */
const BURNING_CLUSTER_COUNT_MIN = 3;
/** Максимальное количество спрайтов в кластере горения. */
const BURNING_CLUSTER_COUNT_MAX = 5;

/** Минимальный масштаб язычка пламени относительно размера клетки. */
export const BURNING_CLUSTER_SCALE_MIN = 0.25;
/** Максимальный масштаб язычка пламени относительно размера клетки. */
export const BURNING_CLUSTER_SCALE_MAX = 0.45;

/** Отступ язычка пламени от краёв клетки по горизонтали. */
export const BURNING_CLUSTER_PADDING_X = 4;
/** Минимальная вертикальная позиция "низа" язычка внутри клетки (0 — верх, 1 — низ). */
export const BURNING_CLUSTER_VERTICAL_MIN = 0.05;
/** Максимальная вертикальная позиция "низа" язычка внутри клетки. */
export const BURNING_CLUSTER_VERTICAL_MAX = 0.9;

/** Амплитуда покачивания язычка влево-вправо. */
export const BURNING_CLUSTER_SWAY_AMPLITUDE = TILE_SIZE * 0.06;
/** Базовая скорость покачивания (радиан в миллисекунду). */
const BURNING_CLUSTER_SWAY_SPEED = 0.003;
/** Разброс скорости покачивания. */
const BURNING_CLUSTER_SWAY_SPEED_VARIATION = 0.002;

type SpriteMeta = {
  /** Базовая X-координата спрайта (до качания). */
  baseX: number;
  /** Фаза качания. */
  swayPhase: number;
  /** Скорость качания. */
  swaySpeed: number;
};

/**
 * Создаёт детерминированный генератор псевдослучайных чисел [0, 1),
 * привязанный к координатам клетки, типу статуса и индексу спрайта.
 * Благодаря этому кластер не "прыгает" при каждом перерисовывании.
 */
function makeStableRandom(x: number, y: number, statusType: string, index: number): () => number {
  let h = 2166136261 >>> 0;
  const mix = (value: number): void => {
    h ^= value >>> 0;
    h = Math.imul(h, 16777619);
  };
  mix(x);
  mix(y);
  for (let i = 0; i < statusType.length; i++) {
    mix(statusType.charCodeAt(i));
  }
  mix(index);

  return () => {
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export class TileEffectStatusRenderer {
  public readonly container: Container;
  private sprites = new Map<string, Sprite>();
  private meta = new Map<string, SpriteMeta>();

  constructor(parentContainer: Container) {
    this.container = parentContainer;
  }

  update(input: RenderInput, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    const map = input.displayState.map;
    const overrender = 1;
    const startCol = Math.floor(cameraX / TILE_SIZE) - overrender;
    const startRow = Math.floor(cameraY / TILE_SIZE) - overrender;
    const endCol = Math.ceil((cameraX + viewportWidth) / TILE_SIZE) + overrender;
    const endRow = Math.ceil((cameraY + viewportHeight) / TILE_SIZE) + overrender;

    const visibleKeys = new Set<string>();

    for (let y = Math.max(0, startRow); y < Math.min(map.height, endRow); y++) {
      for (let x = Math.max(0, startCol); x < Math.min(map.width, endCol); x++) {
        if (!input.debugEnabled && !map.visible[y]?.[x]) continue;

        const tile = map.tiles[y]?.[x];
        if (!tile || !tile.tileEffects || tile.tileEffects.length === 0) continue;
        for (const overlay of tile.tileEffects) {
          if (overlay.kind !== 'status') continue;

          if (CLUSTER_STATUS_TYPES.has(overlay.type)) {
            this.renderCluster(x, y, overlay.type, visibleKeys);
          } else {
            this.renderSingle(x, y, overlay, visibleKeys);
          }
        }
      }
    }

    for (const [key, sprite] of this.sprites) {
      if (!visibleKeys.has(key)) {
        sprite.destroy();
        this.sprites.delete(key);
        this.meta.delete(key);
      }
    }
  }

  /** Покачивание спрайтов пламени влево-вправо. */
  updateAnimations(now: number): void {
    for (const [key, sprite] of this.sprites) {
      const data = this.meta.get(key);
      if (!data) continue;
      sprite.x = data.baseX + Math.sin(now * data.swaySpeed + data.swayPhase) * BURNING_CLUSTER_SWAY_AMPLITUDE;
    }
  }

  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.meta.clear();
  }

  private renderCluster(x: number, y: number, statusType: string, visibleKeys: Set<string>): void {
    const random = makeStableRandom(x, y, statusType, 0);
    const count = Math.floor(
      random() * (BURNING_CLUSTER_COUNT_MAX - BURNING_CLUSTER_COUNT_MIN + 1),
    ) + BURNING_CLUSTER_COUNT_MIN;

    const baseX = x * TILE_SIZE;
    const baseY = y * TILE_SIZE;
    const path = getTileEffectSprite(statusType);

    for (let i = 0; i < count; i++) {
      const key = `${x},${y},${statusType},${i}`;
      visibleKeys.add(key);

      const texture = getTextureSync(path) ?? Texture.EMPTY;
      let sprite = this.sprites.get(key);
      if (!sprite) {
        sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1);
        this.sprites.set(key, sprite);
        this.container.addChild(sprite);

        const rand = makeStableRandom(x, y, statusType, i + 1);
        const scale = BURNING_CLUSTER_SCALE_MIN + rand() * (BURNING_CLUSTER_SCALE_MAX - BURNING_CLUSTER_SCALE_MIN);
        const px = baseX + BURNING_CLUSTER_PADDING_X + rand() * (TILE_SIZE - BURNING_CLUSTER_PADDING_X * 2);
        const py =
          baseY +
          TILE_SIZE * (BURNING_CLUSTER_VERTICAL_MIN + rand() * (BURNING_CLUSTER_VERTICAL_MAX - BURNING_CLUSTER_VERTICAL_MIN));

        const size = TILE_SIZE * scale;
        sprite.x = px;
        sprite.y = py;
        sprite.width = size;
        sprite.height = size;
        sprite.zIndex = py;

        this.meta.set(key, {
          baseX: px,
          swayPhase: rand() * Math.PI * 2,
          swaySpeed: BURNING_CLUSTER_SWAY_SPEED + rand() * BURNING_CLUSTER_SWAY_SPEED_VARIATION,
        });

        if (!getTextureSync(path)) {
          getTexture(path)
            .then((loaded) => {
              const s = this.sprites.get(key);
              if (s) s.texture = loaded;
            })
            .catch(() => {});
        }
      } else {
        if (texture !== Texture.EMPTY && sprite.texture !== texture) {
          sprite.texture = texture;
        }
        sprite.visible = true;
        // zIndex уже содержит корректную Y-координату и не меняется.
      }
    }
  }

  private renderSingle(
    x: number,
    y: number,
    overlay: TileEffectOverlay,
    visibleKeys: Set<string>,
  ): void {
    const key = `${x},${y},${overlay.type}`;
    visibleKeys.add(key);
    const path = getTileEffectSprite(overlay.type);
    const texture = getTextureSync(path) ?? Texture.EMPTY;

    let sprite = this.sprites.get(key);
    if (!sprite) {
      sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1);
      this.sprites.set(key, sprite);
      this.container.addChild(sprite);
    } else if (texture !== Texture.EMPTY && sprite.texture !== texture) {
      sprite.texture = texture;
    }

    const size = TILE_SIZE * TILE_EFFECT_STATUS_SPRITE_SCALE;
    const py = y * TILE_SIZE + TILE_SIZE * TILE_EFFECT_STATUS_OFFSET_Y_FACTOR;
    sprite.zIndex = py;
    sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
    sprite.y = py;
    sprite.width = size;
    sprite.height = size;
    sprite.visible = true;

    if (!getTextureSync(path)) {
      getTexture(path)
        .then((loaded) => {
          const s = this.sprites.get(key);
          if (s) s.texture = loaded;
        })
        .catch(() => {});
    }
  }
}
