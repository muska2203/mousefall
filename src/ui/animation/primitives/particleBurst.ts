/**
 * Низкоуровневый примитив: вспышка частиц, разлетающихся от центра.
 *
 * Подходит для универсальных эффектов (PARTICLE_BURST, STATUS_BURST и др.).
 */

import {Container, Graphics} from 'pixi.js';
import {Easing, type EasingFn, lerp, runTickerTween, type TickerLike} from '@utils/tween';
import {TILE_SIZE} from '@utils/constants';

export interface ParticleBurstOptions {
  /** Родительский контейнер для частиц. */
  parent: Container;
  /** Тикер для анимации. */
  ticker: TickerLike;
  /** Длительность анимации в миллисекундах. */
  duration: number;
  /** Функция сглаживания. По умолчанию easeOutQuad. */
  easing?: EasingFn;
  /** Мировая X-координата центра вспышки (в пикселях). */
  centerX: number;
  /** Мировая Y-координата центра вспышки (в пикселях). */
  centerY: number;
  /** Цвет частиц. */
  color: number;
  /** Количество частиц. */
  count: number;
  /** Радиус одной частицы. По умолчанию 3. */
  particleRadius?: number;
  /** Минимальная скорость разлёта. По умолчанию TILE_SIZE * 0.3. */
  minSpeed?: number;
  /** Максимальная скорость разлёта. По умолчанию TILE_SIZE * 0.6. */
  maxSpeed?: number;
}

/**
 * Запустить вспышку частиц.
 * @returns Promise, резолвящийся по завершении анимации.
 */
export function runParticleBurst(opts: ParticleBurstOptions): Promise<void> {
  const {
    parent,
    ticker,
    duration,
    easing,
    centerX,
    centerY,
    color,
    count,
    particleRadius = 3,
    minSpeed = TILE_SIZE * 0.3,
    maxSpeed = TILE_SIZE * 0.6,
  } = opts;

  const particles = Array.from({length: count}, (_, i) => {
    const g = new Graphics();
    g.circle(0, 0, particleRadius);
    g.fill({color, alpha: 0.9});
    g.x = centerX;
    g.y = centerY;
    parent.addChild(g);

    const angle = (i / count) * Math.PI * 2;
    const speed = minSpeed + ((i % 3) * (maxSpeed - minSpeed)) / 3;
    const targetX = centerX + Math.cos(angle) * speed;
    const targetY = centerY + Math.sin(angle) * speed;

    return {g, targetX, targetY};
  });

  return new Promise((resolve) => {
    runTickerTween(
      {
        duration,
        easing: easing ?? Easing.easeOutQuad,
        onUpdate: (p) => {
          for (const {g, targetX, targetY} of particles) {
            g.x = lerp(centerX, targetX, p);
            g.y = lerp(centerY, targetY, p);
            g.alpha = lerp(0.9, 0, p);
          }
        },
        onComplete: () => {
          for (const {g} of particles) {
            g.destroy();
          }
          resolve();
        },
      },
      ticker,
    );
  });
}
