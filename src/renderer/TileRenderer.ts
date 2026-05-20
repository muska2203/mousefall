/**
 * Рендерер тайлов карты.
 *
 * Использует пул спрайтов для переиспользования объектов.
 * Рендерит только видимые через камеру тайлы.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {GameMap} from '@simulation/types';
import {TILE_SIZE} from '@utils/constants';
import {getTileSprite} from './spriteRegistry';
import {getTexture} from './TextureCache';

export class TileRenderer {
  public readonly container = new Container();
  private sprites = new Map<string, Sprite>();

  async update(map: GameMap, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): Promise<void> {
    const startCol = Math.floor(cameraX / TILE_SIZE);
    const startRow = Math.floor(cameraY / TILE_SIZE);
    const endCol = Math.ceil((cameraX + viewportWidth) / TILE_SIZE);
    const endRow = Math.ceil((cameraY + viewportHeight) / TILE_SIZE);

    const visibleKeys = new Set<string>();
    const texturePaths = new Map<string, string>();

    // Собираем все уникальные пути текстур для параллельной загрузки
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

    // Параллельно загружаем все нужные текстуры
    const textureMap = new Map<string, Texture>();
    await Promise.all(
      Array.from(texturePaths.keys()).map(async (path) => {
        textureMap.set(path, await getTexture(path));
      }),
    );

    // Обновляем спрайты
    for (const key of visibleKeys) {
      const [sx, sy] = key.split(',');
      const x = parseInt(sx!, 10);
      const y = parseInt(sy!, 10);
      const tile = map.tiles[y]?.[x];
      if (!tile) continue;
      const path = getTileSprite(tile);
      const texture = textureMap.get(path)!;

      let sprite = this.sprites.get(key);
      if (!sprite) {
        sprite = new Sprite(texture);
        this.sprites.set(key, sprite);
        this.container.addChild(sprite);
      } else if (sprite.texture !== texture) {
        sprite.texture = texture;
      }

      sprite.x = x * TILE_SIZE;
      sprite.y = y * TILE_SIZE;
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;
      sprite.visible = true;
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
