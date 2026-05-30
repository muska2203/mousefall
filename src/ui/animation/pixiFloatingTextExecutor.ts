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

type DamageAnimationStep = Extract<AnimationStep, { type: 'DAMAGE' }>;
type DamageType = DamageAnimationStep['damageType'];

const DAMAGE_COLORS: Record<DamageType, string> = {
  piercing: '#ff4444',
  slashing: '#ff4444',
  blunt: '#ff4444',
  fire: '#ff8800',
  electric: '#ffdd00',
  poison: '#44ff44',
  frost: '#88ddff',
};

const STAGGER_MS = 150;
const CLEANUP_THRESHOLD_MS = 5000;

export class PixiFloatingTextExecutor implements AnimationExecutor {
  /** Время последнего запуска floating text на клетке (ключ: "x,y"). */
  private lastStartTime = new Map<string, number>();

  canExecute(step: AnimationStep): boolean {
    return step.type === 'DAMAGE' || step.type === 'UI_FLOATING_TEXT';
  }

  async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
    if (step.type !== 'DAMAGE' && step.type !== 'UI_FLOATING_TEXT') return;

    const config = ANIMATION_CONFIG[step.type as AnimationConfigKey];
    const pos = step.type === 'DAMAGE' ? step.position : {x: step.x, y: step.y};
    const text = step.type === 'DAMAGE' ? String(step.amount) : step.text;
    const color = step.type === 'DAMAGE' ? DAMAGE_COLORS[step.damageType] : '#ffffff';

    // Мировые пиксели: центр по X, верх тайла по Y
    const worldX = pos.x * TILE_SIZE + TILE_SIZE / 2;
    const worldY = pos.y * TILE_SIZE;
    const key = `${pos.x},${pos.y}`;

    const now = performance.now();

    // Удаляем устаревшие записи, чтобы Map не рос бесконечно
    for (const [k, t] of this.lastStartTime) {
      if (now - t > CLEANUP_THRESHOLD_MS) {
        this.lastStartTime.delete(k);
      }
    }

    // Атомарно резервируем слот времени для данной клетки
    const last = this.lastStartTime.get(key) ?? 0;
    const startTime = Math.max(now, last + STAGGER_MS);
    this.lastStartTime.set(key, startTime);

    const delay = startTime - now;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    ctx.worldRenderer.showFloatingText(text, worldX, worldY, color, config.duration, ctx.zoom);
    // Floating text — non-blocking, не ждём завершения
  }
}
