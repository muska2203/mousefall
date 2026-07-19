/**
 * Рендерер тайлов карты.
 *
 * Использует пул спрайтов для переиспользования объектов.
 * Рендерит только видимые через камеру тайлы.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {Position, RenderInput} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {getTileSprite} from './spriteRegistry';
import {getTexture, getTextureSync} from './TextureCache';
import {runTickerTween, type TickerLike} from '@utils/tween';

export class TileRenderer {
  public readonly container = new Container();
  private sprites = new Map<string, Sprite>();

  update(input: RenderInput, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    const map = input.displayState.map;
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
        const path = getTileSprite(tile.type);
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
      const path = getTileSprite(tile.type);
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

  /** Анимировать тряску тайлов вокруг центра в заданном радиусе (Чебышёв). */
  shakeTiles(center: Position, radius: number, duration: number, ticker: TickerLike): Promise<void> {
    const targets: { sprite: Sprite; baseX: number; baseY: number }[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = center.x + dx;
        const y = center.y + dy;
        const key = `${x},${y}`;
        const sprite = this.sprites.get(key);
        if (sprite && sprite.visible) {
          targets.push({ sprite, baseX: sprite.x, baseY: sprite.y });
        }
      }
    }

    if (targets.length === 0) return Promise.resolve();

    return new Promise((resolve) => {
      runTickerTween({
        duration,
        easing: (t) => t,
        onUpdate: (p) => {
          const decay = 1 - p;
          const intensity = TILE_SIZE * 0.08 * decay;
          for (const target of targets) {
            const angle = Math.PI * 2 * (target.baseX * 1.37 + target.baseY * 2.71) % (Math.PI * 2);
            const offset = Math.sin(p * Math.PI * 6 + angle) * intensity;
            target.sprite.x = target.baseX + offset;
            target.sprite.y = target.baseY + Math.abs(offset) * 0.3;
          }
        },
        onComplete: () => {
          for (const target of targets) {
            target.sprite.x = target.baseX;
            target.sprite.y = target.baseY;
          }
          resolve();
        },
      }, ticker);
    });
  }

  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.container.removeChildren();
  }
}
