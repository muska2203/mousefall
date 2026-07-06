import { describe, it, expect } from 'vitest';
import {
  randomFloat,
  randomInt,
  randomPick,
  randomShuffle,
  randomChance,
} from '../../../src/utils/random';

describe('randomFloat', () => {
  it('возвращает число в диапазоне [0, 1)', () => {
    const value = randomFloat();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});

describe('randomInt', () => {
  it('возвращает число в диапазоне [min, max]', () => {
    const value = randomInt(1, 6);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
  });

  it('возвращает min, когда min === max', () => {
    expect(randomInt(5, 5)).toBe(5);
  });
});

describe('randomPick', () => {
  it('возвращает элемент из массива', () => {
    const arr = ['a', 'b', 'c'];
    const value = randomPick(arr);
    expect(arr).toContain(value);
  });

  it('бросает ошибку для пустого массива', () => {
    expect(() => randomPick([])).toThrow();
  });
});

describe('randomShuffle', () => {
  it('сохраняет все элементы после перемешивания', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = randomShuffle(arr);
    expect(result).toBe(arr);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('не изменяет пустой массив', () => {
    const arr: number[] = [];
    expect(randomShuffle(arr)).toEqual([]);
  });
});

describe('randomChance', () => {
  it('возвращает true для 100%', () => {
    expect(randomChance(100)).toBe(true);
  });

  it('возвращает false для 0%', () => {
    expect(randomChance(0)).toBe(false);
  });
});
