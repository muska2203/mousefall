/**
 * Кастомная стратегия отрисовки горящего масла (`burning`).
 *
 * Вместо одиночного спрайта рисует кластер из нескольких язычков пламени
 * с индивидуальным масштабом, позицией и покачиванием.
 */

import {Sprite, Texture} from 'pixi.js';
import type {TileEffectOverlay} from '@presentation/displayState/types';
import {TILE_SIZE} from '@utils/constants';
import {getTileEffectSprite} from '../spriteRegistry';
import {getTexture, getTextureSync} from '../TextureCache';
import type {SpriteMeta, TileEffectStatusStrategy} from './types';

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

export class BurningClusterStrategy implements TileEffectStatusStrategy {
  readonly statusType = 'burning';

  constructor(
    private readonly container: any,
    private readonly sprites = new Map<string, Sprite>(),
    private readonly meta = new Map<string, SpriteMeta>(),
  ) {}

  render(x: number, y: number, overlay: TileEffectOverlay, visibleKeys: Set<string>): void {
    const random = makeStableRandom(x, y, overlay.type, 0);
    const count = Math.floor(
      random() * (BURNING_CLUSTER_COUNT_MAX - BURNING_CLUSTER_COUNT_MIN + 1),
    ) + BURNING_CLUSTER_COUNT_MIN;

    const baseX = x * TILE_SIZE;
    const baseY = y * TILE_SIZE;
    const path = getTileEffectSprite(overlay.type);

    for (let i = 0; i < count; i++) {
      const key = `${x},${y},${overlay.type},${i}`;
      visibleKeys.add(key);

      const texture = getTextureSync(path) ?? Texture.EMPTY;
      let sprite = this.sprites.get(key);
      if (!sprite) {
        sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1);
        this.sprites.set(key, sprite);
        this.container.addChild(sprite);

        const rand = makeStableRandom(x, y, overlay.type, i + 1);
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

  getSpriteKeys(): Iterable<string> {
    return this.sprites.keys();
  }

  getSprite(key: string): Sprite | undefined {
    return this.sprites.get(key);
  }

  removeSprite(key: string): void {
    this.sprites.delete(key);
    this.meta.delete(key);
  }
}
