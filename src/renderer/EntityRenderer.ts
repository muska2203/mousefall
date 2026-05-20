/**
 * Рендерер сущностей: игрок + враги.
 *
 * Использует пул спрайтов по entityId.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {GameState, Entity} from '@simulation/types';
import {TILE_SIZE} from '@utils/constants';
import {getPlayerSprite, getEnemySprite} from './spriteRegistry';
import {getTexture} from './TextureCache';

export class EntityRenderer {
  public readonly container = new Container();
  private sprites = new Map<string, Sprite>();

  async update(state: GameState, playerPortraitId: string | null): Promise<void> {
    const visibleIds = new Set<string>();
    const texturePaths = new Map<string, string>();

    // Собираем пути текстур
    const playerPath = getPlayerSprite(playerPortraitId);
    texturePaths.set(playerPath, playerPath);
    visibleIds.add(state.player.id);

    for (const entity of state.entities.values()) {
      if (entity.type === 'enemy') {
        const path = getEnemySprite(entity.templateId);
        texturePaths.set(path, path);
        visibleIds.add(entity.id);
      }
    }

    // Параллельно загружаем
    const textureMap = new Map<string, Texture>();
    await Promise.all(
      Array.from(texturePaths.keys()).map(async (path) => {
        textureMap.set(path, await getTexture(path));
      }),
    );

    // Игрок
    this.renderEntity(state.player.id, state.player.x, state.player.y, textureMap.get(playerPath)!);

    // Враги
    for (const entity of state.entities.values()) {
      if (entity.type === 'enemy') {
        const path = getEnemySprite(entity.templateId);
        this.renderEntity(entity.id, entity.x, entity.y, textureMap.get(path)!);
      }
    }

    // Удаляем спрайты для исчезнувших сущностей
    for (const [id, sprite] of this.sprites) {
      if (!visibleIds.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  private renderEntity(id: string, x: number, y: number, texture: Texture): void {
    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = new Sprite(texture);
      this.sprites.set(id, sprite);
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

  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.container.removeChildren();
  }
}
