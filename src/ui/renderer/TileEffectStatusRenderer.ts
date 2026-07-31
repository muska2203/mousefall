/**
 * Рендерер спрайтов статусов тайловых эффектов.
 *
 * Спрайты добавляются в тот же контейнер, что и акторы, чтобы участвовать
 * в общей Y-сортировке. Отрисовка конкретного статуса делегируется
 * зарегистрированным стратегиям (см. `tileEffectStatusStrategies/`).
 */

import {Container} from 'pixi.js';
import type {RenderInput} from '@presentation/types';
import {TILE_HEIGHT, TILE_SIZE} from '@utils/constants';
import {SingleSpriteStrategy} from './tileEffectStatusStrategies/singleSpriteStrategy';
import {BurningClusterStrategy} from './tileEffectStatusStrategies/burningClusterStrategy';
import {registerTileEffectStatusStrategy} from './tileEffectStatusStrategies/registry';
import type {TileEffectStatusStrategy} from './tileEffectStatusStrategies/types';

export class TileEffectStatusRenderer {
  public readonly container: Container;
  private readonly defaultStrategy: TileEffectStatusStrategy;
  private readonly customStrategies: TileEffectStatusStrategy[] = [];

  constructor(parentContainer: Container) {
    this.container = parentContainer;
    this.defaultStrategy = new SingleSpriteStrategy(this.container);
    this.registerStrategy(new BurningClusterStrategy(this.container));
    registerTileEffectStatusStrategy(this.defaultStrategy);
  }

  private registerStrategy(strategy: TileEffectStatusStrategy): void {
    this.customStrategies.push(strategy);
    registerTileEffectStatusStrategy(strategy);
  }

  update(input: RenderInput, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    const map = input.displayState.map;
    const overrender = 1;
    const startCol = Math.floor(cameraX / TILE_SIZE) - overrender;
    const startRow = Math.floor(cameraY / TILE_HEIGHT) - overrender;
    const endCol = Math.ceil((cameraX + viewportWidth) / TILE_SIZE) + overrender;
    const endRow = Math.ceil((cameraY + viewportHeight) / TILE_HEIGHT) + overrender;

    const visibleKeys = new Set<string>();

    for (let y = Math.max(0, startRow); y < Math.min(map.height, endRow); y++) {
      for (let x = Math.max(0, startCol); x < Math.min(map.width, endCol); x++) {
        if (!input.debugEnabled && !map.visible[y]?.[x]) continue;

        const tile = map.tiles[y]?.[x];
        if (!tile || !tile.tileEffects || tile.tileEffects.length === 0) continue;
        for (const overlay of tile.tileEffects) {
          if (overlay.kind !== 'status') continue;

          const strategy = this.findStrategy(overlay.type);
          strategy.render(x, y, overlay, visibleKeys);
        }
      }
    }

    // Удаляем спрайты всех стратегий, которые вышли из видимой области.
    for (const strategy of [this.defaultStrategy, ...this.customStrategies]) {
      for (const key of strategy.getSpriteKeys()) {
        if (!visibleKeys.has(key)) {
          strategy.getSprite(key)?.destroy();
          strategy.removeSprite(key);
        }
      }
    }
  }

  /** Покачивание и другие анимации спрайтов статусов. */
  updateAnimations(now: number): void {
    this.defaultStrategy.updateAnimations(now);
    for (const strategy of this.customStrategies) {
      strategy.updateAnimations(now);
    }
  }

  clear(): void {
    this.defaultStrategy.clear();
    for (const strategy of this.customStrategies) {
      strategy.clear();
    }
  }

  private findStrategy(statusType: string): TileEffectStatusStrategy {
    return this.customStrategies.find((s) => s.statusType === statusType) ?? this.defaultStrategy;
  }
}
