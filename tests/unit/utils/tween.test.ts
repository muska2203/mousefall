/**
 * Unit tests for tween utilities.
 */

import {describe, expect, it, vi} from 'vitest';
import {lerp, clamp01, Easing, Tween, ScalarTween, Vec2Tween, runTickerTween} from '../../../src/utils/tween';

describe('lerp', () => {
  it('returns start at t=0', () => {
    expect(lerp(0, 10, 0)).toBe(0);
  });

  it('returns end at t=1', () => {
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('works with negative ranges', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });
});

describe('clamp01', () => {
  it('clamps negatives to 0', () => {
    expect(clamp01(-0.5)).toBe(0);
  });

  it('clamps values above 1 to 1', () => {
    expect(clamp01(1.5)).toBe(1);
  });

  it('leaves values inside [0,1] unchanged', () => {
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe('Easing', () => {
  it('linear(0) = 0, linear(0.5) = 0.5, linear(1) = 1', () => {
    expect(Easing.linear(0)).toBe(0);
    expect(Easing.linear(0.5)).toBe(0.5);
    expect(Easing.linear(1)).toBe(1);
  });

  it('easeOutQuad(0) = 0, easeOutQuad(1) = 1', () => {
    expect(Easing.easeOutQuad(0)).toBe(0);
    expect(Easing.easeOutQuad(1)).toBe(1);
  });

  it('easeInQuad(0) = 0, easeInQuad(1) = 1', () => {
    expect(Easing.easeInQuad(0)).toBe(0);
    expect(Easing.easeInQuad(1)).toBe(1);
  });
});

describe('Tween', () => {
  it('calls onUpdate with eased progress and onComplete at finish', () => {
    const onUpdate = vi.fn();
    const onComplete = vi.fn();

    const tween = new Tween({ duration: 100, easing: Easing.linear, onUpdate, onComplete });
    tween.start(0);

    expect(tween.update(0)).toBe(false);
    expect(onUpdate).toHaveBeenLastCalledWith(0);
    expect(onComplete).not.toHaveBeenCalled();

    expect(tween.update(50)).toBe(false);
    expect(onUpdate).toHaveBeenLastCalledWith(0.5);

    expect(tween.update(100)).toBe(true);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('returns true for subsequent updates after finish', () => {
    const tween = new Tween({ duration: 10, onUpdate: () => {} });
    tween.start(0);
    expect(tween.update(10)).toBe(true);
    expect(tween.update(20)).toBe(true);
  });
});

describe('ScalarTween', () => {
  it('interpolates scalar value', () => {
    const values: number[] = [];
    const tween = new ScalarTween({ from: 0, to: 10, duration: 100, onUpdate: (v) => values.push(v) });
    tween.start(0);
    tween.update(0);
    tween.update(50);
    tween.update(100);
    expect(values).toEqual([0, 5, 10]);
  });
});

describe('Vec2Tween', () => {
  it('interpolates 2D vector', () => {
    const points: {x: number; y: number}[] = [];
    const tween = new Vec2Tween({
      from: { x: 0, y: 0 },
      to: { x: 10, y: 20 },
      duration: 100,
      onUpdate: (x, y) => points.push({ x, y }),
    });
    tween.start(0);
    tween.update(0);
    tween.update(50);
    tween.update(100);
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 20 }]);
  });
});

describe('runTickerTween', () => {
  it('resolves after duration via ticker', async () => {
    const callbacks: Array<() => void> = [];
    const mockTicker = {
      add: vi.fn((fn: () => void) => callbacks.push(fn)),
      remove: vi.fn((fn: () => void) => {
        const idx = callbacks.indexOf(fn);
        if (idx !== -1) callbacks.splice(idx, 1);
      }),
    };

    const onUpdate = vi.fn();
    const onComplete = vi.fn();

    const cancel = runTickerTween(
      { duration: 100, easing: Easing.linear, onUpdate, onComplete },
      mockTicker as any
    );

    expect(mockTicker.add).toHaveBeenCalledOnce();

    // Симулируем прохождение времени через ticker
    callbacks[0]!();
    const firstValue = onUpdate.mock.calls[onUpdate.mock.calls.length - 1]![0];
    expect(firstValue).toBeGreaterThanOrEqual(0);
    expect(firstValue).toBeLessThan(1);
    expect(onComplete).not.toHaveBeenCalled();

    // Прогоняем до завершения
    while (!onComplete.mock.calls.length) {
      callbacks[0]!();
    }

    expect(onComplete).toHaveBeenCalledOnce();
    expect(mockTicker.remove).toHaveBeenCalled();

    cancel(); // Не должно упасть
  });

  it('can be cancelled', () => {
    const callbacks: Array<() => void> = [];
    const mockTicker = {
      add: vi.fn((fn: () => void) => callbacks.push(fn)),
      remove: vi.fn((fn: () => void) => {
        const idx = callbacks.indexOf(fn);
        if (idx !== -1) callbacks.splice(idx, 1);
      }),
    };

    const onComplete = vi.fn();
    const cancel = runTickerTween(
      { duration: 1000, easing: Easing.linear, onUpdate: () => {} },
      mockTicker as any
    );

    cancel();
    expect(mockTicker.remove).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
