/**
 * Unit-тесты низкоуровневых примитивов UI-анимаций.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  createMockPixiModule,
  type MockContainer,
  type MockGraphics,
  type MockTicker
} from '../../../../tests/helpers/mockPixi';
import {Container, Graphics, Ticker} from 'pixi.js';
import {
  FollowCamera,
  runArc,
  runBeam,
  runParticleBurst,
  runTweenedGraphics,
} from '../../../../src/ui/animation/primitives';

vi.mock('pixi.js', () => createMockPixiModule());

function makeTicker(): MockTicker {
  return new Ticker() as unknown as MockTicker;
}

function makeParent(): MockContainer & Container {
  return new Container() as unknown as MockContainer & Container;
}

function tick(nowRef: {value: number}, ticker: MockTicker, ms: number): void {
  nowRef.value += ms;
  ticker.callbacks.forEach((cb) => cb());
}

describe('animation primitives', () => {
  let nowRef: {value: number};

  beforeEach(() => {
    nowRef = {value: 0};
    vi.spyOn(performance, 'now').mockImplementation(() => nowRef.value);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runTweenedGraphics', () => {
    it('creates Graphics, runs setup, animates via update and destroys on complete', () => {
      const parent = makeParent();
      const ticker = makeTicker();
      const setup = vi.fn();
      const update = vi.fn();
      const onComplete = vi.fn();

      runTweenedGraphics({
        parent,
        ticker,
        duration: 100,
        setup,
        update,
        onComplete,
      });

      expect(parent.children.length).toBe(1);
      expect(setup).toHaveBeenCalledTimes(1);
      expect(setup).toHaveBeenCalledWith(parent.children[0]);

      tick(nowRef, ticker, 50);
      expect(update).toHaveBeenCalled();

      tick(nowRef, ticker, 100);
      expect(parent.children.length).toBe(0);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('uses linear easing by default', () => {
      const parent = makeParent();
      const ticker = makeTicker();
      const progressValues: number[] = [];

      runTweenedGraphics({
        parent,
        ticker,
        duration: 100,
        setup: () => {},
        update: (_, p) => progressValues.push(p),
      });

      tick(nowRef, ticker, 50);
      // Linear easing: progress should equal normalized time (≈0.5).
      expect(progressValues[progressValues.length - 1]).toBeCloseTo(0.5, 1);
    });
  });

  describe('runParticleBurst', () => {
    it('creates requested number of particle Graphics and removes them after animation', () => {
      const parent = makeParent();
      const ticker = makeTicker();

      const promise = runParticleBurst({
        parent,
        ticker,
        duration: 100,
        centerX: 16,
        centerY: 16,
        color: 0xff0000,
        count: 8,
      });

      expect(parent.children.length).toBe(8);
      for (const child of parent.children) {
        const g = child as unknown as MockGraphics;
        expect(g.commands.some((c) => c.method === 'fill')).toBe(true);
      }

      tick(nowRef, ticker, 100);
      return promise.then(() => {
        expect(parent.children.length).toBe(0);
      });
    });
  });

  describe('runArc', () => {
    it('creates Graphics, draws an arc and destroys on complete', () => {
      const parent = makeParent();
      const ticker = makeTicker();

      const promise = runArc({
        parent,
        ticker,
        duration: 100,
        centerX: 16,
        centerY: 16,
        radius: 32,
        startAngle: 0,
        endAngle: Math.PI / 2,
        lineWidth: 4,
        color: 0xff0000,
      });

      expect(parent.children.length).toBe(1);
      const g = parent.children[0] as unknown as MockGraphics;
      expect(g.x).toBe(16);
      expect(g.y).toBe(16);

      tick(nowRef, ticker, 50);
      expect(g.commands.some((c) => c.method === 'arc')).toBe(true);
      expect(g.commands.some((c) => c.method === 'stroke')).toBe(true);

      tick(nowRef, ticker, 100);
      return promise.then(() => {
        expect(parent.children.length).toBe(0);
      });
    });
  });

  describe('runBeam', () => {
    it('creates Graphics, draws a line from start to current target and fades out', () => {
      const parent = makeParent();
      const ticker = makeTicker();

      const promise = runBeam({
        parent,
        ticker,
        duration: 100,
        fromX: 0,
        fromY: 0,
        toX: 32,
        toY: 32,
        color: 0x00ff00,
        lineWidth: 3,
      });

      expect(parent.children.length).toBe(1);
      const g = parent.children[0] as unknown as MockGraphics;

      tick(nowRef, ticker, 50);
      expect(g.commands.some((c) => c.method === 'moveTo')).toBe(true);
      expect(g.commands.some((c) => c.method === 'lineTo')).toBe(true);
      expect(g.commands.some((c) => c.method === 'stroke')).toBe(true);

      tick(nowRef, ticker, 100);
      return promise.then(() => {
        expect(parent.children.length).toBe(0);
      });
    });
  });

  describe('FollowCamera', () => {
    it('positions object at camera world pos plus offset', () => {
      const camera = {x: 100, y: 200};
      const object = new Graphics() as unknown as MockGraphics & Graphics;

      const follow = new FollowCamera({
        getCameraWorldPos: () => camera,
        object,
        offsetX: 10,
        offsetY: -5,
      });

      expect(object.x).toBe(110);
      expect(object.y).toBe(195);

      camera.x = 150;
      follow.update();
      expect(object.x).toBe(160);
    });
  });
});
