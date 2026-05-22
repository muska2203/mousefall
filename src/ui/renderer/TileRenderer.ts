/**
 * Рендерер тайлов карты.
 *
 * Использует пул спрайтов для переиспользования объектов.
 * Рендерит только видимые через камеру тайлы.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {RenderInput} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {getTileSprite} from './spriteRegistry';
import {getTexture, getTextureSync} from './TextureCache';

export class TileRenderer {
  public readonly container = new Container();
  private sprites = new Map<string, Sprite>();

  update(input: RenderInput, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    const map = input.state.map;
    const overrender = 1;
    const startCol = Math.floor(cameraX / TILE_SIZE) - overrender;
    const startRow = Math.floor(cameraY / TILE_SIZE) - overrender;
    const endCol = Math.ceil((cameraX + viewportWidth) / TILE_SIZE) + overrender;
    const endRow = Math.ceil((cameraY + viewportHeight) / TILE_SIZE) + overrender;

    const visibleKeys = new Set<string>();
    const texturePaths = new Map<string, string>();

    // Собираем все уникальные пути текстур
    for (let y = Math.max(0, startRow); y < Math.min(map.height, endRow); y++) {
      for (let x = Math.max(0, startCol); x < Math.min(map.width, endCol); x++) {
        const tile = map.tiles[y]?.[x];
        if (!tile) continue;
        const key = `${x},${y}`;
        visibleKeys.add(key);
        const path = getTileSprite(tile);
        texturePaths.set(path, path);
      }
    }

    // Обновляем спрайты синхронно (Texture.EMPTY как fallback)
    for (const key of visibleKeys) {
      const [sx, sy] = key.split(',');
      const x = parseInt(sx!, 10);
      const y = parseInt(sy!, 10);
      const tile = map.tiles[y]?.[x];
      if (!tile) continue;
      const path = getTileSprite(tile);
      const texture = getTextureSync(path) ?? Texture.EMPTY;

      let sprite = this.sprites.get(key);
      if (!sprite) {
        sprite = new Sprite(texture);
        this.sprites.set(key, sprite);
        this.container.addChild(sprite);
      } else if (texture !== Texture.EMPTY && sprite.texture !== texture) {
        sprite.texture = texture;
      }

      sprite.x = x * TILE_SIZE;
      sprite.y = y * TILE_SIZE;
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;
      sprite.visible = true;

      // Фоновая подгрузка текстуры, если её ещё нет в кеше
      if (!getTextureSync(path)) {
        getTexture(path)
          .then((loaded) => {
            const s = this.sprites.get(key);
            if (s) s.texture = loaded;
          })
          .catch(() => {});
      }
    }

    // Скрываем спрайты вне камеры
    for (const [key, sprite] of this.sprites) {
      if (!visibleKeys.has(key)) {
        sprite.visible = false;
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
