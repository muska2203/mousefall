/**
 * Executor анимации броска предмета (ITEM_THROW).
 *
 * Анимирует спрайт предмета, летящий по дуге от актора к целевой клетке.
 */

import {Sprite, Texture} from 'pixi.js';
import type {AnimationContext, AnimationExecutor} from './types';
import type {AnimationStep, Position} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import {TILE_SIZE} from '@utils/constants';
import {registerAnimationExecutor} from './registry';
import {getTexture} from '@ui/renderer/TextureCache';
import {resolveItemIcon} from '@utils/assetResolver';
import {runTickerTween} from '@utils/tween';

export class ItemThrowAnimationExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'ITEM_THROW';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'ITEM_THROW') return;

    const config = ANIMATION_CONFIG.ITEM_THROW;
    const from = this.toScreen(step.from);
    const to = this.toScreen(step.to);

    const texture = await this.getItemTexture(step.spriteId);

    const sprite = new Sprite(texture ?? Texture.EMPTY);
    sprite.anchor.set(0.5);
    sprite.x = from.x;
    sprite.y = from.y;
    sprite.visible = texture !== null;

    // Масштабируем спрайт так, чтобы его размер зависел от TILE_SIZE, а не от исходного PNG.
    const relativeSize = config.relativeSize ?? 1;
    if (texture && texture.width > 0 && texture.height > 0) {
      const maxDim = Math.max(texture.width, texture.height);
      const targetSize = TILE_SIZE * relativeSize;
      sprite.scale.set(targetSize / maxDim);
    } else {
      sprite.scale.set(1);
    }

    const parent = ctx.worldRenderer.root;
    parent.addChild(sprite);

    const control = this.computeControlPoint(from, to);

    return new Promise((resolve) => {
      runTickerTween(
        {
          duration: config.duration,
          easing: config.easing,
          onUpdate: (p) => {
            const q = 1 - p;
            // Квадратичная Безье: (1-p)^2 * from + 2(1-p)p * control + p^2 * to
            sprite.x = q * q * from.x + 2 * q * p * control.x + p * p * to.x;
            sprite.y = q * q * from.y + 2 * q * p * control.y + p * p * to.y;
          },
          onComplete: () => {
            parent.removeChild(sprite);
            sprite.destroy();
            resolve();
          },
        },
        ctx.ticker,
      );
    });
  }

  private toScreen(pos: Position): { x: number; y: number } {
    return {
      x: pos.x * TILE_SIZE + TILE_SIZE / 2,
      y: pos.y * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  private computeControlPoint(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): { x: number; y: number } {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const distance = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
    // Дуга выше середины; чем больше расстояние, тем выше подъём.
    const arcHeight = Math.max(TILE_SIZE * 0.5, distance * 0.35);
    return { x: midX, y: midY - arcHeight };
  }

  private async getItemTexture(spriteId: string): Promise<Texture | null> {
    const path = resolveItemIcon(spriteId);
    try {
      return await getTexture(path);
    } catch {
      return null;
    }
  }
}

registerAnimationExecutor(new ItemThrowAnimationExecutor());
