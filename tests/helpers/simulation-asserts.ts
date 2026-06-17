import { expect } from 'vitest';
import type { SimulationResult } from '../../src/simulation/types';

/**
 * Возвращает первое событие ACTION_REJECTED из результата dispatch.
 * Удобен для проверки кодов отказа без хрупких цепочек `!`.
 */
export function findRejectedEvent(result: SimulationResult): { type: 'ACTION_REJECTED'; errors: { code: string }[] } | undefined {
  const rejected = result.phases[0]?.actions[0]?.children.find(
    c => c.event.type === 'ACTION_REJECTED',
  );
  if (!rejected) return undefined;
  return rejected.event as { type: 'ACTION_REJECTED'; errors: { code: string }[] };
}

/**
 * Проверяет, что результат dispatch содержит отказ с указанным кодом.
 */
export function expectRejected(result: SimulationResult, code: string): void {
  const rejected = findRejectedEvent(result);
  expect(rejected).toBeDefined();
  expect(rejected!.errors[0]?.code).toBe(code);
}
