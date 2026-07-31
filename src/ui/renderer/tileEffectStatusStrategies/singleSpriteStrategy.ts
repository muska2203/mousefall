/**
 * Стратегия отрисовки статуса тайлового эффекта одним спрайтом.
 *
 * Используется по умолчанию для всех статусов без собственной кастомной стратегии.
 */

import {Sprite, Texture} from 'pixi.js';
import type {TileEffectOverlay} from '@presentation/displayState/types';
import {TILE_EFFECT_STATUS_OFFSET_Y_FACTOR, TILE_EFFECT_STATUS_SPRITE_SCALE, TILE_HEIGHT, TILE_SIZE,} from '@utils/constants';
import {getTileEffectSprite} from '../spriteRegistry';
import {getTexture, getTextureSync} from '../TextureCache';
import type {TileEffectStatusStrategy} from './types';

export class SingleSpriteStrategy implements TileEffectStatusStrategy {
  readonly statusType = 'single_sprite_default';

  constructor(
    private readonly container: any,
    private readonly sprites = new Map<string, Sprite>(),
  ) {}

  render(x: number, y: number, overlay: TileEffectOverlay, visibleKeys: Set<string>): void {
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
    const py = y * TILE_HEIGHT + TILE_HEIGHT * TILE_EFFECT_STATUS_OFFSET_Y_FACTOR;
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

  updateAnimations(_now: number): void {
    // У одиночного спрайта нет анимаций.
  }

  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
  }

  getSpriteKeys(): Iterable<string> {
    return this.sprites.keys();
  }

  getSprite(key: string): Sprite | undefined {
    return this.sprites.get(key);
  }

  removeSprite(key: string): void {
    this.sprites.delete(key);
  }
}
