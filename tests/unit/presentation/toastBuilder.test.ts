/**
 * Unit tests for toastBuilder.
 */

import {describe, expect, it} from 'vitest';
import '@i18n/config';
import {extractToasts} from '../../../src/presentation/toastBuilder';
import type {ExecutionNode} from '../../../src/simulation/systems/actions/types';
import type {SimulationResult, GameEvent} from '../../../src/simulation/types';

function makeExecNode(event: GameEvent, children: ExecutionNode[] = []): ExecutionNode {
  return { event, parent: null, children };
}

function makeResult(actions: ExecutionNode[]): SimulationResult {
  return { success: false, stateChanged: false, hasMoreSteps: false, phases: [{ side: 'player', actions }] };
}

describe('extractToasts', () => {
  it('returns empty array when there are no rejected actions', () => {
    const node = makeExecNode({ type: 'ENTITY_MOVED', movementType: 'walk', entityId: 'player', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    const result = makeResult([node]);

    expect(extractToasts(result)).toHaveLength(0);
  });

  it('extracts not_enough_ap as warning toast', () => {
    const node = makeExecNode({ type: 'ACTION_REJECTED', errors: [{ code: 'not_enough_ap' }] });
    const result = makeResult([node]);

    const toasts = extractToasts(result);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('warning');
    expect(toasts[0]!.title.length).toBeGreaterThan(0);
    expect(toasts[0]!.message.length).toBeGreaterThan(0);
    expect(toasts[0]!.duration).toBeGreaterThan(0);
  });

  it('extracts ability_on_cooldown as warning toast', () => {
    const node = makeExecNode({ type: 'ACTION_REJECTED', errors: [{ code: 'ability_on_cooldown' }] });
    const result = makeResult([node]);

    const toasts = extractToasts(result);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('warning');
  });

  it('extracts actor_cannot_act as error toast', () => {
    const node = makeExecNode({ type: 'ACTION_REJECTED', errors: [{ code: 'actor_cannot_act' }] });
    const result = makeResult([node]);

    const toasts = extractToasts(result);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('error');
  });

  it('ignores unknown error codes', () => {
    const node = makeExecNode({ type: 'ACTION_REJECTED', errors: [{ code: 'unknown_error_code' }] });
    const result = makeResult([node]);

    expect(extractToasts(result)).toHaveLength(0);
  });

  it('walks nested execution tree', () => {
    const child = makeExecNode({ type: 'ACTION_REJECTED', errors: [{ code: 'invalid_target' }] });
    const parent = makeExecNode({ type: 'ACTION_APPLIED', action: { type: 'ATTACK', entityId: 'player', dx: 1, dy: 0 } }, [child]);
    const result = makeResult([parent]);

    const toasts = extractToasts(result);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('warning');
  });

  it('collects multiple errors from the same rejected event', () => {
    const node = makeExecNode({
      type: 'ACTION_REJECTED',
      errors: [{ code: 'not_enough_ap' }, { code: 'ability_on_cooldown' }],
    });
    const result = makeResult([node]);

    const toasts = extractToasts(result);
    expect(toasts).toHaveLength(2);
  });
});
