/**
 * Unit-тесты для BeamAnimationExecutor.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  createMockPixiModule,
  type MockContainer,
  type MockGraphics,
  type MockTicker
} from '../../../../tests/helpers/mockPixi';
import {Container, Ticker} from 'pixi.js';
import {BeamAnimationExecutor} from '../../../../src/ui/animation/beamExecutor';
import type {AnimationContext} from '../../../../src/ui/animation/types';
import type {AnimationStep} from '../../../../src/presentation/types';

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

describe('BeamAnimationExecutor', () => {
  let nowRef: {value: number};

  beforeEach(() => {
    nowRef = {value: 0};
    vi.spyOn(performance, 'now').mockImplementation(() => nowRef.value);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes BEAM step and draws a line between from and to tiles', async () => {
    const executor = new BeamAnimationExecutor();
    const parent = makeParent();
    const ticker = makeTicker();
    const context: AnimationContext = {
      worldRenderer: {root: parent} as any,
      ticker: ticker as any,
      playerId: 'player',
      zoom: 1,
      worldToScreen: (pos) => ({x: pos.x * 32, y: pos.y * 32}),
    };
    const step: AnimationStep = {
      type: 'BEAM',
      from: {x: 1, y: 1},
      to: {x: 3, y: 3},
      color: 0x88ddff,
    };

    expect(executor.canExecute(step)).toBe(true);
    expect(executor.canExecute({type: 'PROJECTILE', from: {x: 0, y: 0}, to: {x: 1, y: 1}})).toBe(false);

    const promise = executor.execute(step, context);
    expect(parent.children.length).toBe(1);

    const g = parent.children[0] as unknown as MockGraphics;
    tick(nowRef, ticker, 125);
    expect(g.commands.some((c) => c.method === 'moveTo')).toBe(true);
    expect(g.commands.some((c) => c.method === 'lineTo')).toBe(true);
    expect(g.commands.some((c) => c.method === 'stroke')).toBe(true);

    tick(nowRef, ticker, 250);
    await promise;
    expect(parent.children.length).toBe(0);
  });

  it('ignores non-BEAM steps', async () => {
    const executor = new BeamAnimationExecutor();
    const context: AnimationContext = {
      worldRenderer: {root: makeParent()} as any,
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
