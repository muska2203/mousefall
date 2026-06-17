/**
 * Unit tests for AnimationSequencer.
 */

import {describe, expect, it, vi} from 'vitest';
import {AnimationSequencer} from '../../../../src/ui/animation/sequencer';
import type {AnimationExecutor, AnimationContext} from '../../../../src/ui/animation/types';
import type {AnimationNode, AnimationStep, AnimationPhase, TurnSide} from '../../../../src/presentation/types';

function makeMockExecutor(type: string, fn: () => Promise<void>): AnimationExecutor {
  return {
    canExecute: (step: AnimationStep) => step.type === type,
    execute: vi.fn(fn),
  };
}

function makeNode(step: AnimationStep, children: AnimationNode[] = []): AnimationNode {
  return { step, children };
}

function makePhase(nodes: AnimationNode[], side: TurnSide = 'PLAYER', sequential?: boolean): AnimationPhase {
  return { side, nodes, sequential };
}

const mockContext: AnimationContext = {
  worldRenderer: {} as any,
  ticker: {} as any,
  playerId: 'player',
  zoom: 1,
  worldToScreen: (pos) => ({ x: pos.x * 32, y: pos.y * 32 }),
};

describe('AnimationSequencer', () => {
  it('runs blocking node and resolves blockingDone when finished', async () => {
    const exec = makeMockExecutor('MOVE', async () => {});
    const sequencer = new AnimationSequencer([exec], mockContext);

    const node = makeNode({ type: 'MOVE', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    const result = sequencer.run([makePhase([node])]);

    await result.blockingDone;
    expect(exec.execute).toHaveBeenCalledOnce();
  });

  it('runs children sequentially after parent finishes', async () => {
    const order: string[] = [];
    const parentExec = makeMockExecutor('ATTACK', async () => { order.push('parent'); });
    const childExec = makeMockExecutor('DEATH', async () => { order.push('child'); });
    const sequencer = new AnimationSequencer([parentExec, childExec], mockContext);

    const child = makeNode({ type: 'DEATH', entityId: 'e1' });
    const parent = makeNode({ type: 'ATTACK', attackerId: 'p1', dx: 1, dy: 0 }, [child]);

    const result = sequencer.run([makePhase([parent])]);
    await result.allDone;

    expect(order).toEqual(['parent', 'child']);
  });

  it('runs siblings in parallel', async () => {
    const execA = makeMockExecutor('ATTACK', async () => {});
    const execB = makeMockExecutor('MOVE', async () => {});
    const sequencer = new AnimationSequencer([execA, execB], mockContext);

    const nodeA = makeNode({ type: 'ATTACK', attackerId: 'p1', dx: 1, dy: 0 });
    const nodeB = makeNode({ type: 'MOVE', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });

    const result = sequencer.run([makePhase([nodeA, nodeB])]);
    await result.allDone;

    expect(execA.execute).toHaveBeenCalledOnce();
    expect(execB.execute).toHaveBeenCalledOnce();
  });

  it('runs sequential phase nodes one after another', async () => {
    const order: string[] = [];
    const execA = makeMockExecutor('ATTACK', async () => { order.push('a'); });
    const execB = makeMockExecutor('MOVE', async () => { order.push('b'); });
    const sequencer = new AnimationSequencer([execA, execB], mockContext);

    const nodeA = makeNode({ type: 'ATTACK', attackerId: 'p1', dx: 1, dy: 0 });
    const nodeB = makeNode({ type: 'MOVE', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });

    const result = sequencer.run([makePhase([nodeA, nodeB], 'ENVIRONMENT', true)]);
    await result.allDone;

    expect(order).toEqual(['a', 'b']);
  });

  it('calls onPhaseStart for each phase', async () => {
    const exec = makeMockExecutor('MOVE', async () => {});
    const sequencer = new AnimationSequencer([exec], mockContext);

    const node = makeNode({ type: 'MOVE', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    const sides: TurnSide[] = [];
    const result = sequencer.run(
      [makePhase([node], 'PLAYER'), makePhase([node], 'ENVIRONMENT', true)],
      { onPhaseStart: (side) => sides.push(side) },
    );
    await result.allDone;

    expect(sides).toEqual(['PLAYER', 'ENVIRONMENT']);
  });

  it('resolves blockingDone immediately if no blocking nodes', async () => {
    const exec = makeMockExecutor('FOG_UPDATE', async () => {});
    const sequencer = new AnimationSequencer([exec], mockContext);

    const node = makeNode({ type: 'FOG_UPDATE', newlyVisible: [] });
    const result = sequencer.run([makePhase([node])]);

    // blockingDone должно резолвиться мгновенно, т.к. FOG_UPDATE non-blocking
    const start = Date.now();
    await result.blockingDone;
    expect(Date.now() - start).toBeLessThan(50);

    // allDone всё ещё ждёт завершения executor
    await result.allDone;
    expect(exec.execute).toHaveBeenCalledOnce();
  });

  it('resolves blockingDone only after all blocking nodes finish', async () => {
    const exec = makeMockExecutor('MOVE', async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const sequencer = new AnimationSequencer([exec], mockContext);

    const node = makeNode({ type: 'MOVE', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    const result = sequencer.run([makePhase([node])]);

    const start = Date.now();
    await result.blockingDone;
    expect(Date.now() - start).toBeGreaterThanOrEqual(20);
  });

  it('cancelAll resolves blockingDone immediately and skips children', async () => {
    const order: string[] = [];
    const parentExec = makeMockExecutor('ATTACK', async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      order.push('parent');
    });
    const childExec = makeMockExecutor('DEATH', async () => { order.push('child'); });
    const sequencer = new AnimationSequencer([parentExec, childExec], mockContext);

    const child = makeNode({ type: 'DEATH', entityId: 'e1' });
    const parent = makeNode({ type: 'ATTACK', attackerId: 'p1', dx: 1, dy: 0 }, [child]);

    const result = sequencer.run([makePhase([parent])]);
    sequencer.cancelAll();

    // blockingDone должно резолвиться мгновенно
    await result.blockingDone;

    // allDone дождётся завершения уже запущенного parent, но child не запустится
    await result.allDone;

    expect(order).toEqual(['parent']);
    expect(childExec.execute).not.toHaveBeenCalled();
  });
});
