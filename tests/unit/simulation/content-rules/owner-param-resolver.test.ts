/**
 * Тесты ownerParam-формы resolveParametrizedValue.
 *
 * ownerParam — ссылка на ролленное значение rule-аффикса владельца
 * (paramValue активного правила). База берётся из третьего аргумента,
 * fallback — 0; multiply/min/round работают как у context-формы.
 */

import { describe, expect, it } from 'vitest';
import { resolveParametrizedValue } from '../../../../src/simulation/content-rules/value-resolver';
import type { RuleContext } from '../../../../src/simulation/content-rules/rule-context';

// ownerParam-форма не читает контекст — достаточно пустого объекта.
const ctx = {} as RuleContext;

describe('resolveParametrizedValue: ownerParam', () => {
  it('возвращает переданное значение владельца', () => {
    expect(resolveParametrizedValue({ type: 'ownerParam' }, ctx, 7)).toBe(7);
  });

  it('без значения владельца возвращает 0 (fallback)', () => {
    expect(resolveParametrizedValue({ type: 'ownerParam' }, ctx)).toBe(0);
    expect(resolveParametrizedValue({ type: 'ownerParam' }, ctx, undefined)).toBe(0);
  });

  it('применяет multiply и round', () => {
    // 3 * 1.5 = 4.5 → 5
    expect(resolveParametrizedValue({ type: 'ownerParam', multiply: 1.5, round: true }, ctx, 3)).toBe(5);
  });

  it('применяет min после multiply', () => {
    expect(resolveParametrizedValue({ type: 'ownerParam', min: 3 }, ctx, 1)).toBe(3);
    expect(resolveParametrizedValue({ type: 'ownerParam', min: 3 }, ctx, 5)).toBe(5);
  });

  it('числовые и literal-значения игнорируют значение владельца', () => {
    expect(resolveParametrizedValue(4, ctx, 7)).toBe(4);
    expect(resolveParametrizedValue({ type: 'literal', value: 2 }, ctx, 7)).toBe(2);
  });
});
