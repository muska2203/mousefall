import {describe, expect, it} from 'vitest';
import {sortStatusEffects} from '../../../src/presentation/statusSorting';

describe('statusSorting', () => {
  it('sorts status effects with stunned first', () => {
    const sorted = sortStatusEffects([
      {type: 'burning', duration: 2, value: 1, statModifiers: null},
      {type: 'stunned', duration: 1, value: 0, statModifiers: null},
      {type: 'poisoned', duration: 3, value: 2, statModifiers: null},
    ]);

    expect(sorted.map((e) => e.type)).toEqual(['stunned', 'burning', 'poisoned']);
  });

  it('places unknown statuses at the end', () => {
    const sorted = sortStatusEffects([
      {type: 'unknown' as unknown as 'stunned', duration: 1, value: 0, statModifiers: null},
      {type: 'stunned', duration: 1, value: 0, statModifiers: null},
    ]);

    expect(sorted.map((e) => e.type)).toEqual(['stunned', 'unknown']);
  });
});
