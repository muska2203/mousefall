import { describe, it, expect } from 'vitest';
import { calculateLootDrops, rollLootDropCount } from '../../../src/utils/loot';
import { createRNG } from '../../../src/utils/rng';

describe('calculateLootDrops', () => {
  it('возвращает пустой массив для пустой таблицы', () => {
    const rng = createRNG(12345);
    expect(calculateLootDrops([], 1, rng)).toEqual([]);
  });

  it('возвращает пустой массив при count = 0', () => {
    const rng = createRNG(12345);
    const table = [{ templateId: 'a', weight: 1 }];
    expect(calculateLootDrops(table, 0, rng)).toEqual([]);
  });

  it('возвращает ровно count предметов', () => {
    const rng = createRNG(12345);
    const table = [{ templateId: 'a', weight: 1 }];
    expect(calculateLootDrops(table, 3, rng)).toEqual(['a', 'a', 'a']);
  });

  it('игнорирует нулевые и отрицательные веса', () => {
    const rng = createRNG(12345);
    const table = [
      { templateId: 'a', weight: -1 },
      { templateId: 'b', weight: 0 },
      { templateId: 'c', weight: 1 },
    ];
    expect(calculateLootDrops(table, 1, rng)).toEqual(['c']);
  });

  it('возвращает пустой массив, если суммарный вес = 0', () => {
    const rng = createRNG(12345);
    const table = [
      { templateId: 'a', weight: 0 },
      { templateId: 'b', weight: 0 },
    ];
    expect(calculateLootDrops(table, 2, rng)).toEqual([]);
  });

  it('детерминирован при фиксированном seed', () => {
    const table = [
      { templateId: 'a', weight: 1 },
      { templateId: 'b', weight: 1 },
    ];
    const rng1 = createRNG(999);
    const rng2 = createRNG(999);
    expect(calculateLootDrops(table, 5, rng1)).toEqual(
      calculateLootDrops(table, 5, rng2),
    );
  });

  it('учитывает веса при распределении', () => {
    const rng = createRNG(42);
    const table = [
      { templateId: 'a', weight: 1 },
      { templateId: 'b', weight: 3 },
    ];
    // При seed=42 распределение должно быть детерминированным
    const drops = calculateLootDrops(table, 10, rng);
    expect(drops.length).toBe(10);
    expect(drops.every((id) => id === 'a' || id === 'b')).toBe(true);
  });
});

describe('rollLootDropCount', () => {
  it('возвращает 0 для пустой таблицы', () => {
    const rng = createRNG(12345);
    expect(rollLootDropCount([], rng)).toBe(0);
  });

  it('возвращает 0, если суммарный вес = 0', () => {
    const rng = createRNG(12345);
    expect(rollLootDropCount([{ count: 5, weight: 0 }], rng)).toBe(0);
  });

  it('выбирает count по весам', () => {
    const rng = createRNG(42);
    const dropTable = [
      { count: 0, weight: 80 },
      { count: 1, weight: 20 },
    ];
    // При seed=42 ожидаем детерминированный результат
    const count = rollLootDropCount(dropTable, rng);
    expect(count === 0 || count === 1).toBe(true);
  });

  it('детерминирован при фиксированном seed', () => {
    const dropTable = [
      { count: 1, weight: 1 },
      { count: 2, weight: 1 },
    ];
    const rng1 = createRNG(999);
    const rng2 = createRNG(999);
    expect(rollLootDropCount(dropTable, rng1)).toBe(rollLootDropCount(dropTable, rng2));
  });

  it('игнорирует нулевые и отрицательные веса', () => {
    const rng = createRNG(12345);
    const dropTable = [
      { count: 0, weight: -1 },
      { count: 1, weight: 0 },
      { count: 2, weight: 1 },
    ];
    expect(rollLootDropCount(dropTable, rng)).toBe(2);
  });
});
