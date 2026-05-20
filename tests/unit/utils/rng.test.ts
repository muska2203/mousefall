/**
 * Unit tests for the RNG utility.
 *
 * Tests determinism, distribution, and edge cases.
 */

import {describe, expect, it} from 'vitest';
import {createRNG, rngChance, rngFloat, rngInt, rngPick, rngShuffle} from '../../../src/utils/rng';

describe('createRNG', () => {
  it('creates RNG with the given seed', () => {
    const rng = createRNG(42);
    expect(rng.seed).toBe(42);
    expect(rng.state).toBe(42);
  });

  it('two RNGs with the same seed produce the same sequence', () => {
    const rng1 = createRNG(999);
    const rng2 = createRNG(999);

    const seq1 = Array.from({ length: 10 }, () => rngFloat(rng1));
    const seq2 = Array.from({ length: 10 }, () => rngFloat(rng2));

    expect(seq1).toEqual(seq2);
  });

  it('two RNGs with different seeds produce different sequences', () => {
    const rng1 = createRNG(1);
    const rng2 = createRNG(2);

    const seq1 = Array.from({ length: 5 }, () => rngFloat(rng1));
    const seq2 = Array.from({ length: 5 }, () => rngFloat(rng2));

    expect(seq1).not.toEqual(seq2);
  });
});

describe('rngFloat', () => {
  it('returns values in [0, 1)', () => {
    const rng = createRNG(123);
    for (let i = 0; i < 1000; i++) {
      const v = rngFloat(rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('advances state on each call', () => {
    const rng = createRNG(42);
    const s0 = rng.state;
    rngFloat(rng);
    expect(rng.state).not.toBe(s0);
  });
});

describe('rngInt', () => {
  it('returns integers in [min, max] inclusive', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 1000; i++) {
      const v = rngInt(rng, 1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('returns min when min === max', () => {
    const rng = createRNG(42);
    expect(rngInt(rng, 5, 5)).toBe(5);
  });
});

describe('rngPick', () => {
  it('picks an element from the array', () => {
    const rng = createRNG(42);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(rngPick(rng, arr));
    }
  });

  it('throws on empty array', () => {
    const rng = createRNG(42);
    expect(() => rngPick(rng, [])).toThrow();
  });
});

describe('rngShuffle', () => {
  it('returns the same array reference', () => {
    const rng = createRNG(42);
    const arr = [1, 2, 3, 4, 5];
    const result = rngShuffle(rng, arr);
    expect(result).toBe(arr);
  });

  it('contains the same elements after shuffle', () => {
    const rng = createRNG(42);
    const arr = [1, 2, 3, 4, 5];
    rngShuffle(rng, arr);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic with same seed', () => {
    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [1, 2, 3, 4, 5];
    rngShuffle(createRNG(99), arr1);
    rngShuffle(createRNG(99), arr2);
    expect(arr1).toEqual(arr2);
  });
});

describe('rngChance', () => {
  it('returns true for 100%', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(rngChance(rng, 100)).toBe(true);
    }
  });

  it('returns false for 0%', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(rngChance(rng, 0)).toBe(false);
    }
  });
});
