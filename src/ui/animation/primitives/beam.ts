/**
 * Низкоуровневый примитив: луч/линия, рисуемая от одной точки к другой.
 *
 * Используется для кастомных анимаций типа BEAM и других линейных эффектов.
 */

import {Container, Graphics} from 'pixi.js';
import {Easing, type EasingFn, lerp, runTickerTween, type TickerLike} from '@utils/tween';

export interface BeamOptions {
  /** Родительский контейнер для луча. */
  parent: Container;
  /** Тикер для анимации. */
  ticker: TickerLike;
  /** Длительность анимации в миллисекундах. */
  duration: number;
  /** Функция сглаживания. По умолчанию linear. */
  easing?: EasingFn;
  /** Начальная мировая X-координата. */
  fromX: number;
  /** Начальная мировая Y-координата. */
  fromY: number;
  /** Конечная мировая X-координата. */
  toX: number;
  /** Конечная мировая Y-координата. */
  toY: number;
  /** Цвет луча. */
  color: number;
  /** Толщина линии. По умолчанию 2. */
  lineWidth?: number;
  /** Если true, луч затухает к концу анимации. По умолчанию true. */
  fadeOut?: boolean;
}

/**
 * Запустить анимацию луча.
 * @returns Promise, резолвящийся по завершении анимации.
 */
export function runBeam(opts: BeamOptions): Promise<void> {
  const {parent, ticker, duration, easing, fromX, fromY, toX, toY, color, lineWidth = 2, fadeOut = true} = opts;

  const g = new Graphics();
  parent.addChild(g);

  return new Promise((resolve) => {
    runTickerTween(
      {
        duration,
        easing: easing ?? Easing.linear,
        onUpdate: (p) => {
          const currentX = lerp(fromX, toX, p);
          const currentY = lerp(fromY, toY, p);

          g.clear();
          g.moveTo(fromX, fromY);
          g.lineTo(currentX, currentY);
          g.stroke({width: lineWidth, color});

          if (fadeOut) {
            g.alpha = lerp(1, 0, p);
          }
        },
        onComplete: () => {
          g.destroy();
          resolve();
        },
      },
      ticker,
    );
  });
}
