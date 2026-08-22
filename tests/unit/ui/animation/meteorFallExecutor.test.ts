/**
 * Unit-тесты для MeteorFallAnimationExecutor.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  createMockPixiModule,
  type MockContainer,
  type MockGraphics,
  type MockTicker
} from '../../../../tests/helpers/mockPixi';
import {Container, Ticker} from 'pixi.js';
import {MeteorFallAnimationExecutor} from '../../../../src/ui/animation/meteorFallExecutor';
import type {AnimationContext} from '../../../../src/ui/animation/types';
import type {AnimationStep} from '../../../../src/presentation/types';
import {ANIMATION_CONFIG, ANIMATION_SPEED_SCALE} from '../../../../src/utils/animationConfig';

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

describe('MeteorFallAnimationExecutor', () => {
  let nowRef: {value: number};

  beforeEach(() => {
    nowRef = {value: 0};
    vi.spyOn(performance, 'now').mockImplementation(() => nowRef.value);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes METEOR_FALL step and draws a falling meteor', async () => {
    const executor = new MeteorFallAnimationExecutor();
    const parent = makeParent();
    const ticker = makeTicker();
    const context: AnimationContext = {
      worldRenderer: {root: parent, cameraWorldPos: {x: 0, y: 0}} as any,
      ticker: ticker as any,
      playerId: 'player',
      zoom: 1,
      worldToScreen: (pos) => ({x: pos.x * 32, y: pos.y * 32}),
    };
    const step: AnimationStep = {
      type: 'METEOR_FALL',
      from: {x: 1, y: -1},
      to: {x: 3, y: 3},
      color: 0xff5500,
    };

    expect(executor.canExecute(step)).toBe(true);
    expect(executor.canExecute({type: 'PROJECTILE', from: {x: 0, y: 0}, to: {x: 1, y: 1}})).toBe(false);

    const promise = executor.execute(step, context);
    // Метеорит + возможные частицы шлейда появляются в root.
    expect(parent.children.length).toBeGreaterThanOrEqual(1);

    const g = parent.children[0] as unknown as MockGraphics;
    tick(nowRef, ticker, 200);
    expect(g.commands.some((c) => c.method === 'circle')).toBe(true);
    expect(g.commands.some((c) => c.method === 'fill')).toBe(true);

    // Завершаем падение метеорита. Фактическая длительность с учётом глобального
    // скейлера скорости: duration / ANIMATION_SPEED_SCALE.
    tick(nowRef, ticker, ANIMATION_CONFIG.METEOR_FALL.duration / ANIMATION_SPEED_SCALE - 200 + 1);
    await Promise.resolve();

    // Даём executor'у запустить вспышку частиц, затем завершаем её (250 мс / скейлер).
    tick(nowRef, ticker, 250 / ANIMATION_SPEED_SCALE + 1);
    await promise;
  });

  it('ignores non-METEOR_FALL steps', async () => {
    const executor = new MeteorFallAnimationExecutor();
    const context: AnimationContext = {
      worldRenderer: {root: makeParent(), cameraWorldPos: {x: 0, y: 0}} as any,
      ticker: makeTicker() as any,
      playerId: 'player',
      zoom: 1,
      worldToScreen: (pos) => ({x: pos.x * 32, y: pos.y * 32}),
    };
    const step: AnimationStep = {type: 'MOVE', entityId: 'e1', from: {x: 0, y: 0}, to: {x: 1, y: 0}};

    await executor.execute(step, context);
    expect(context.worldRenderer.root.children.length).toBe(0);
  });
});
