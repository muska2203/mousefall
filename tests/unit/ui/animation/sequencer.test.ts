/**
 * Unit tests for AnimationSequencer.
 */

import {describe, expect, it, vi} from 'vitest';
import {AnimationSequencer} from '../../../../src/ui/animation/sequencer';
import type {AnimationExecutor, AnimationContext} from '../../../../src/ui/animation/types';
import type {AnimationNode, AnimationStep} from '../../../../src/presentation/types';

function makeMockExecutor(type: string, fn: () => Promise<void>): AnimationExecutor {
  return {
    canExecute: (step: AnimationStep) => step.type === type,
    execute: vi.fn(fn),
  };
}

function makeNode(step: AnimationStep, children: AnimationNode[] = []): AnimationNode {
  return { step, children };
}

const mockContext: AnimationContext = {
  worldRenderer: {} as any,
  playerId: 'player',
  zoom: 1,
  worldToScreen: (pos) => ({ x: pos.x * 32, y: pos.y * 32 }),
};

describe('AnimationSequencer', () => {
  it('runs blocking node and resolves blockingDone when finished', async () => {
    const exec = makeMockExecutor('MOVE', async () => {});
    const sequencer = new AnimationSequencer([exec], mockContext);

    const node = makeNode({ type: 'MOVE', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    const result = sequencer.run([node]);

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

    const result = sequencer.run([parent]);
    await result.allDone;

    expect(order).toEqual(['parent', 'child']);
  });

  it('runs siblings in parallel', async () => {
    const execA = makeMockExecutor('ATTACK', async () => {});
    const execB = makeMockExecutor('MOVE', async () => {});
    const sequencer = new AnimationSequencer([execA, execB], mockContext);

    const nodeA = makeNode({ type: 'ATTACK', attackerId: 'p1', dx: 1, dy: 0 });
    const nodeB = makeNode({ type: 'MOVE', entityId: 'e1', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });

    const result = sequencer.run([nodeA, nodeB]);
    await result.allDone;

    expect(execA.execute).toHaveBeenCalledOnce();
    expect(execB.execute).toHaveBeenCalledOnce();
  });

  it('resolves blockingDone immediately if no blocking nodes', async () => {
    const exec = makeMockExecutor('FOG_UPDATE', async () => {});
    const sequencer = new AnimationSequencer([exec], mockContext);

    const node = makeNode({ type: 'FOG_UPDATE', newlyVisible: [] });
    const result = sequencer.run([node]);

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
    const result = sequencer.run([node]);

    const start = Date.now();
    await result.blockingDone;
    expect(Date.now() - start).toBeGreaterThanOrEqual(20);
  });
});
