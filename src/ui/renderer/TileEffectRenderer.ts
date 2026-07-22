/**
 * Рендерер оверлеев тайловых эффектов.
 *
 * Рисует полупрозрачные спрайты поверх базовых тайлов.
 * Порядок в WorldRenderer: после tileRenderer, перед entityRenderer.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {RenderInput} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {getTileEffectSprite} from './spriteRegistry';
import {getTexture, getTextureSync} from './TextureCache';

export class TileEffectRenderer {
  public readonly container = new Container();
  private sprites = new Map<string, Sprite>();

  constructor() {
    this.container.sortableChildren = true;
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
        const tile = map.tiles[y]?.[x];
        if (!tile || !tile.tileEffects || tile.tileEffects.length === 0) continue;
        for (const overlay of tile.tileEffects) {
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

          sprite.zIndex = overlay.renderOrder;
          sprite.x = x * TILE_SIZE;
          sprite.y = y * TILE_SIZE;
          sprite.width = TILE_SIZE;
          sprite.height = TILE_SIZE;
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
    }

    for (const [key, sprite] of this.sprites) {
      if (!visibleKeys.has(key)) {
        sprite.destroy();
        this.sprites.delete(key);
      }
    }
  }

  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.container.removeChildren();
  }
}
