/**
 * Executor всплывающего текста через PixiJS (DAMAGE, UI_FLOATING_TEXT).
 *
 * Правила:
 * - Работает через FloatingTextRenderer внутри WorldRenderer.
 * - Координаты задаются в мировых пикселях — zoom и камера применяются автоматически.
 * - Non-blocking: запускает анимацию и сразу возвращает управление.
 */

import type {AnimationExecutor, AnimationContext} from './types';
import type {AnimationStep} from '@presentation/types';
import {ANIMATION_CONFIG} from '@utils/animationConfig';
import type {AnimationConfigKey} from '@utils/animationConfig';
import {TILE_SIZE} from '@utils/constants';

export class PixiFloatingTextExecutor implements AnimationExecutor {
  canExecute(step: AnimationStep): boolean {
    return step.type === 'DAMAGE' || step.type === 'UI_FLOATING_TEXT';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'DAMAGE' && step.type !== 'UI_FLOATING_TEXT') return;

    const config = ANIMATION_CONFIG[step.type as AnimationConfigKey];
    const pos = step.type === 'DAMAGE' ? step.position : {x: step.x, y: step.y};
    const text = step.type === 'DAMAGE' ? String(step.amount) : step.text;
    const color = step.type === 'DAMAGE' ? '#ff4444' : '#ffffff';

    // Мировые пиксели: центр по X, верх тайла по Y
    const worldX = pos.x * TILE_SIZE + TILE_SIZE / 2;
    const worldY = pos.y * TILE_SIZE;

    ctx.worldRenderer.showFloatingText(text, worldX, worldY, color, config.duration);
    // Floating text — non-blocking, не ждём завершения
  }
}
