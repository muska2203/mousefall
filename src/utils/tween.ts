/**
 * Минимальный tween-движок для PixiJS-анимаций.
 *
 * Правила:
 * - Не зависит от PixiJS напрямую; получает время извне (performance.now() или Ticker).
 * - Только easing + progress; конкретный lerp выполняет потребитель.
 */

export type EasingFn = (t: number) => number;

export const Easing = {
  linear: (t: number): number => t,

  easeOutQuad: (t: number): number => t * (2 - t),

  easeInQuad: (t: number): number => t * t,

  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
} as const;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/** Базовый tween прогресса от 0 до 1 с easing.
 *  update(now) возвращает true, если анимация завершена. */
export interface TweenOptions {
  duration: number;
  easing?: EasingFn;
  onUpdate: (progress: number) => void;
  onComplete?: () => void;
}

/** Общий интерфейс для всех tween-объектов. */
export interface Animatable {
  start(now: number): void;
  update(now: number): boolean;
  cancel(): void;
}

export class Tween implements Animatable {
  private startTime = 0;
  private started = false;
  private finished = false;

  constructor(private readonly opts: TweenOptions) {}

  start(now: number): void {
    this.startTime = now;
    this.started = true;
    this.finished = false;
  }

  update(now: number): boolean {
    if (!this.started || this.finished) {
      return true;
    }

    const elapsed = now - this.startTime;
    const t = clamp01(elapsed / this.opts.duration);
    const eased = (this.opts.easing ?? Easing.linear)(t);

    this.opts.onUpdate(eased);

    if (t >= 1) {
      this.finished = true;
      this.opts.onComplete?.();
      return true;
    }
    return false;
  }

  cancel(): void {
    this.finished = true;
  }
}

/** Tween для скалярного значения. */
export interface ScalarTweenOptions {
  from: number;
  to: number;
  duration: number;
  easing?: EasingFn;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}

export class ScalarTween implements Animatable {
  private tween: Tween;

  constructor(opts: ScalarTweenOptions) {
    this.tween = new Tween({
      duration: opts.duration,
      easing: opts.easing,
      onUpdate: (p) => opts.onUpdate(lerp(opts.from, opts.to, p)),
      onComplete: opts.onComplete,
    });
  }

  start(now: number): void {
    this.tween.start(now);
  }

  update(now: number): boolean {
    return this.tween.update(now);
  }

  cancel(): void {
    this.tween.cancel();
  }
}

/** Tween для 2D-вектора (x, y). */
export interface Vec2TweenOptions {
  from: { x: number; y: number };
  to: { x: number; y: number };
  duration: number;
  easing?: EasingFn;
  onUpdate: (x: number, y: number, progress: number) => void;
  onComplete?: () => void;
}

export class Vec2Tween implements Animatable {
  private tween: Tween;

  constructor(opts: Vec2TweenOptions) {
    this.tween = new Tween({
      duration: opts.duration,
      easing: opts.easing,
      onUpdate: (p) => {
        opts.onUpdate(
          lerp(opts.from.x, opts.to.x, p),
          lerp(opts.from.y, opts.to.y, p),
          p
        );
      },
      onComplete: opts.onComplete,
    });
  }

  start(now: number): void {
    this.tween.start(now);
  }

  update(now: number): boolean {
    return this.tween.update(now);
  }

  cancel(): void {
    this.tween.cancel();
  }
}

/** Минимальный интерфейс тикера, совместимый с PixiJS Ticker.
 *  Позволяет runTickerTween не зависеть от PixiJS напрямую. */
export interface TickerLike {
  add<T>(fn: (this: T, ...args: any[]) => void, context?: T): void;
  remove<T>(fn: (this: T, ...args: any[]) => void, context?: T): void;
}

/** Запустить Tween через внешний тикер (например, PixiJS Ticker).
 *  Возвращает функцию отмены. */
export function runTickerTween(opts: TweenOptions, ticker: TickerLike): () => void {
  const tween = new Tween(opts);
  tween.start(performance.now());

  const tick = () => {
    const finished = tween.update(performance.now());
    if (finished) {
      ticker.remove(tick);
    }
  };

  ticker.add(tick);

  return () => {
    ticker.remove(tick);
    tween.cancel();
  };
}
