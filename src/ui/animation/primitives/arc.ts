/**
 * Низкоуровневый примитив: анимированная дуга.
 *
 * Дуга "разворачивается" от startAngle к endAngle в первой половине
 * анимации и затухает во второй.
 */

import {Container, Graphics} from 'pixi.js';
import {Easing, type EasingFn, lerp, runTickerTween, type TickerLike} from '@utils/tween';

export interface ArcOptions {
  /** Родительский контейнер для дуги. */
  parent: Container;
  /** Тикер для анимации. */
  ticker: TickerLike;
  /** Длительность анимации в миллисекундах. */
  duration: number;
  /** Функция сглаживания. По умолчанию easeOutQuad. */
  easing?: EasingFn;
  /** Мировая X-координата центра дуги. */
  centerX: number;
  /** Мировая Y-координата центра дуги. */
  centerY: number;
  /** Радиус дуги. */
  radius: number;
  /** Начальный угол (радианы). */
  startAngle: number;
  /** Конечный угол (радианы). */
  endAngle: number;
  /** Толщина линии. */
  lineWidth: number;
  /** Цвет линии. */
  color: number;
}

/**
 * Запустить анимацию дуги.
 * @returns Promise, резолвящийся по завершении анимации.
 */
export function runArc(opts: ArcOptions): Promise<void> {
  const {parent, ticker, duration, easing, centerX, centerY, radius, startAngle, endAngle, lineWidth, color} = opts;

  const g = new Graphics();
  g.x = centerX;
  g.y = centerY;
  g.alpha = 0;
  parent.addChild(g);

  return new Promise((resolve) => {
    runTickerTween(
      {
        duration,
        easing: easing ?? Easing.easeOutQuad,
        onUpdate: (p) => {
          let currentEndAngle: number;
          let alpha: number;

          if (p <= 0.5) {
            // Первая половина: дуга разворачивается и появляется.
            const t = p * 2;
            currentEndAngle = lerp(startAngle, endAngle, t);
            alpha = lerp(0, 0.9, t);
          } else {
            // Вторая половина: полная дуга затухает.
            currentEndAngle = endAngle;
            const t = (p - 0.5) * 2;
            alpha = lerp(0.9, 0, t);
          }

          g.clear();
          g.arc(0, 0, radius, startAngle, currentEndAngle, false);
          g.stroke({width: lineWidth, color});
          g.alpha = alpha;
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
