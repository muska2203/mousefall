/**
 * Стратегия отрисовки статуса тайлового эффекта одним спрайтом.
 *
 * Используется по умолчанию для всех статусов без собственной кастомной стратегии.
 */

import {Sprite, Texture} from 'pixi.js';
import type {TileEffectOverlay} from '@presentation/displayState/types';
import {getSpritePlacement} from '@presentation/spritePlacementResolver';
import {applyPlacement} from '../spritePlacement';
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
      this.sprites.set(key, sprite);
      this.container.addChild(sprite);
    } else if (texture !== Texture.EMPTY && sprite.texture !== texture) {
      sprite.texture = texture;
    }

    // Размещение значка статуса: дефолт категории, возможен override в шаблоне статуса.
    const placement = getSpritePlacement(overlay.type, 'tileEffectStatus');
    const anchor = applyPlacement(sprite, x, y, placement);
    sprite.zIndex = anchor.y;
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
