import { describe, expect, it } from 'vitest';
import { rollItemAbility } from '../../../../src/simulation/systems/item-ability-roll';
import { createRNG } from '../../../../src/utils/rng';
import type { ItemTemplate } from '../../../../src/content/schemas';

function mockItemTemplate(abilityPool: ItemTemplate['abilityPool']): ItemTemplate {
  return {
    id: 'test_item',
    type: 'weapon',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool,
    equipModifiers: [],
    grantedAbilities: [],
  };
}

describe('rollItemAbility', () => {
  it('возвращает null при пустом abilityPool', () => {
    const template = mockItemTemplate([]);
    const rng = createRNG(12345);
    expect(rollItemAbility(template, rng)).toBeNull();
  });

  it('возвращает null, если abilityPool не задан', () => {
    const template = mockItemTemplate(undefined as unknown as []);
    const rng = createRNG(12345);
    expect(rollItemAbility(template, rng)).toBeNull();
  });

  it('всегда возвращает level === 1', () => {
    const template = mockItemTemplate([{ abilityId: 'fireball', weight: 1 }]);
    const rng = createRNG(12345);
    const result = rollItemAbility(template, rng);
    expect(result).not.toBeNull();
    expect(result!.level).toBe(1);
  });

  it('детерминирован при фиксированном seed', () => {
    const template = mockItemTemplate([
      { abilityId: 'a', weight: 1 },
      { abilityId: 'b', weight: 1 },
      { abilityId: 'c', weight: 1 },
    ]);
    const rng1 = createRNG(99999);
    const rng2 = createRNG(99999);
    const result1 = rollItemAbility(template, rng1);
    const result2 = rollItemAbility(template, rng2);
    expect(result1).toEqual(result2);
  });

  it('учитывает веса при выборе', () => {
    // Пул с одним доминирующим элементом — должен всегда выбирать его
    const template = mockItemTemplate([
      { abilityId: 'always', weight: 1000 },
      { abilityId: 'never', weight: 1 },
    ]);
    const rng = createRNG(77777);
    const result = rollItemAbility(template, rng);
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe('always');
  });
});
