import { describe, expect, it } from 'vitest';
import { rollItemAbility } from '../../../../src/simulation/systems/item-ability-roll';
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
    apCost: 1,
  };
}

describe('rollItemAbility', () => {
  it('возвращает null при пустом abilityPool', () => {
    const template = mockItemTemplate([]);
    expect(rollItemAbility(template)).toBeNull();
  });

  it('возвращает null, если abilityPool не задан', () => {
    const template = mockItemTemplate(undefined as unknown as []);
    expect(rollItemAbility(template)).toBeNull();
  });

  it('всегда возвращает level === 1', () => {
    const template = mockItemTemplate([{ abilityId: 'fireball', weight: 1 }]);
    const result = rollItemAbility(template);
    expect(result).not.toBeNull();
    expect(result!.level).toBe(1);
  });

  it('возвращает abilityId из пула', () => {
    const template = mockItemTemplate([
      { abilityId: 'a', weight: 1 },
      { abilityId: 'b', weight: 1 },
      { abilityId: 'c', weight: 1 },
    ]);
    const result = rollItemAbility(template);
    expect(result).not.toBeNull();
    expect(['a', 'b', 'c']).toContain(result!.templateId);
  });

  it('учитывает веса при выборе', () => {
    // Пул с одним доминирующим элементом — должен почти всегда выбирать его
    const template = mockItemTemplate([
      { abilityId: 'always', weight: 1000 },
      { abilityId: 'never', weight: 1 },
    ]);
    const result = rollItemAbility(template);
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe('always');
  });
});
