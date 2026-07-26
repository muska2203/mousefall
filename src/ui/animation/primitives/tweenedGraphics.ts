/**
 * Низкоуровневый примитив: Graphics, анимированный через tween.
 *
 * Создаёт Graphics, добавляет его в parent, запускает tween и автоматически
 * уничтожает объект по завершении. Потребитель задаёт начальное состояние
 * через setup и обновление кадра через update.
 */

import {Container, Graphics} from 'pixi.js';
import {Easing, type EasingFn, runTickerTween, type TickerLike} from '@utils/tween';

export interface TweenedGraphicsOptions {
  /** Родительский контейнер, в который добавляется Graphics. */
  parent: Container;
  /** Тикер для обновления анимации. */
  ticker: TickerLike;
  /** Длительность анимации в миллисекундах. */
  duration: number;
  /** Функция сглаживания. По умолчанию linear. */
  easing?: EasingFn;
  /** Начальная настройка Graphics перед стартом. */
  setup: (g: Graphics) => void;
  /** Обновление Graphics на каждом кадре. progress ∈ [0, 1]. */
  update: (g: Graphics, progress: number) => void;
  /** Дополнительный колбэк по завершении. */
  onComplete?: () => void;
}

/**
 * Запустить tween для Graphics.
 * @returns Функция отмены анимации.
 */
export function runTweenedGraphics(opts: TweenedGraphicsOptions): () => void {
  const g = new Graphics();
  opts.setup(g);
  opts.parent.addChild(g);

  return runTickerTween(
    {
      duration: opts.duration,
      easing: opts.easing ?? Easing.linear,
      onUpdate: (p) => opts.update(g, p),
      onComplete: () => {
        g.destroy();
        opts.onComplete?.();
      },
    },
    opts.ticker,
  );
}
