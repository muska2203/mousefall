import { describe, it, expect } from 'vitest';
import { calculateLootDrops, rollLootDropCount } from '../../../src/utils/loot';

describe('calculateLootDrops', () => {
  it('возвращает пустой массив для пустой таблицы', () => {
    expect(calculateLootDrops([], 1)).toEqual([]);
  });

  it('возвращает пустой массив при count = 0', () => {
    const table = [{ templateId: 'a', weight: 1 }];
    expect(calculateLootDrops(table, 0)).toEqual([]);
  });

  it('возвращает ровно count предметов', () => {
    const table = [{ templateId: 'a', weight: 1 }];
    expect(calculateLootDrops(table, 3)).toEqual(['a', 'a', 'a']);
  });

  it('игнорирует нулевые и отрицательные веса', () => {
    const table = [
      { templateId: 'a', weight: -1 },
      { templateId: 'b', weight: 0 },
      { templateId: 'c', weight: 1 },
    ];
    expect(calculateLootDrops(table, 1)).toEqual(['c']);
  });

  it('возвращает пустой массив, если суммарный вес = 0', () => {
    const table = [
      { templateId: 'a', weight: 0 },
      { templateId: 'b', weight: 0 },
    ];
    expect(calculateLootDrops(table, 2)).toEqual([]);
  });

  it('возвращает элементы только из таблицы', () => {
    const table = [
      { templateId: 'a', weight: 1 },
      { templateId: 'b', weight: 1 },
    ];
    const drops = calculateLootDrops(table, 5);
    expect(drops.length).toBe(5);
    expect(drops.every((id) => id === 'a' || id === 'b')).toBe(true);
  });

  it('учитывает веса при распределении', () => {
    const table = [
      { templateId: 'a', weight: 1 },
      { templateId: 'b', weight: 3 },
    ];
    const drops = calculateLootDrops(table, 10);
    expect(drops.length).toBe(10);
    expect(drops.every((id) => id === 'a' || id === 'b')).toBe(true);
  });
});

describe('rollLootDropCount', () => {
  it('возвращает 0 для пустой таблицы', () => {
    expect(rollLootDropCount([])).toBe(0);
  });

  it('возвращает 0, если суммарный вес = 0', () => {
    expect(rollLootDropCount([{ count: 5, weight: 0 }])).toBe(0);
  });

  it('выбирает count из допустимого множества', () => {
    const dropTable = [
      { count: 0, weight: 80 },
      { count: 1, weight: 20 },
    ];
    const count = rollLootDropCount(dropTable);
    expect(count === 0 || count === 1).toBe(true);
  });

  it('возвращает count из таблицы', () => {
    const dropTable = [
      { count: 1, weight: 1 },
      { count: 2, weight: 1 },
    ];
    const count = rollLootDropCount(dropTable);
    expect(count === 1 || count === 2).toBe(true);
  });

  it('игнорирует нулевые и отрицательные веса', () => {
    const dropTable = [
      { count: 0, weight: -1 },
      { count: 1, weight: 0 },
      { count: 2, weight: 1 },
    ];
    expect(rollLootDropCount(dropTable)).toBe(2);
  });
});
