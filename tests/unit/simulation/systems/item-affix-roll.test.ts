/**
 * Тесты аффиксов экземпляра экипировки (item-affix-roll).
 *
 * Проверяем:
 * - пул фильтруется по subtype предмета;
 * - ровно 1 положительный аффикс при непустом пуле;
 * - до 1 отрицательного с шансом NEGATIVE_AFFIX_CHANCE;
 * - value из рейнжа уровня (ranges[level-1]) с clamp к последнему;
 * - scaling 'none' даёт value = null;
 * - исключение из пула: poolEligible false, модификатор из fixedModifiers,
 *   rule-модификатор с конфликтующим ruleId;
 * - buildFixedAffixes: origin 'fixed', значение из scaling 'fixed' (null для 'none');
 * - createItemAffixes: фирменные аффиксы идут первыми;
 * - детерминизм по seed.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { initRegistry, resetRegistry } from '@content/registry.ts';
import type { ItemTemplate, ModifierTemplate } from '@content/schemas';
import {
  buildFixedAffixes,
  createItemAffixes,
  rollItemAffixes,
} from '@simulation/systems/item-affix-roll.ts';
import { createRNG } from '@utils/rng';

function mockModifier(id: string, overrides: Partial<ModifierTemplate> = {}): ModifierTemplate {
  return {
    id,
    polarity: 'positive',
    effect: { kind: 'stat', stat: 'armor', op: 'add' },
    scaling: { kind: 'perLevel', ranges: [{ min: 1, max: 2 }, { min: 3, max: 4 }] },
    applicableSubtypes: ['sword'],
    poolEligible: true,
    weight: 1,
    ...overrides,
  } as ModifierTemplate;
}

function mockWeapon(id: string, overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id,
    type: 'weapon',
    subtype: 'sword',
    level: 1,
    stackable: false,
    maxStack: 1,
    value: 0,
    ...overrides,
  } as ItemTemplate;
}

function initWithModifiers(modifiers: ModifierTemplate[]): void {
  resetRegistry();
  initRegistry({
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    maps: new Map(),
    doors: new Map(),
    stairs: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
    modifiers: new Map(modifiers.map((m) => [m.id, m])),
  });
}

afterEach(() => {
  resetRegistry();
});

describe('rollItemAffixes', () => {
  it('возвращает пустой массив для предмета без subtype', () => {
    initWithModifiers([mockModifier('mod_a')]);
    const consumable = mockWeapon('potion', { type: 'consumable', subtype: undefined });
    expect(rollItemAffixes(createRNG(1), consumable)).toEqual([]);
  });

  it('возвращает пустой массив, если пул по подтипу пуст', () => {
    // Модификатор только для мечей, предмет — посох.
    initWithModifiers([mockModifier('mod_a', { applicableSubtypes: ['sword'] })]);
    const staff = mockWeapon('staff', { subtype: 'staff' });
    expect(rollItemAffixes(createRNG(1), staff)).toEqual([]);
  });

  it('роллит ровно один положительный аффикс из пула подтипа', () => {
    initWithModifiers([
      mockModifier('mod_sword_a'),
      mockModifier('mod_sword_b'),
      mockModifier('mod_club_only', { applicableSubtypes: ['club'] }),
    ]);
    const sword = mockWeapon('sword');

    for (let seed = 1; seed <= 20; seed++) {
      const affixes = rollItemAffixes(createRNG(seed), sword);
      expect(affixes).toHaveLength(1);
      expect(['mod_sword_a', 'mod_sword_b']).toContain(affixes[0]!.modifierId);
    }
  });

  it('отрицательный аффикс выпадает с шансом и не более одного', () => {
    initWithModifiers([
      mockModifier('mod_positive'),
      mockModifier('mod_negative', { polarity: 'negative' }),
    ]);
    const sword = mockWeapon('sword');

    let withNegative = 0;
    let withoutNegative = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const affixes = rollItemAffixes(createRNG(seed), sword);
      expect(affixes.length).toBeLessThanOrEqual(2);
      expect(affixes[0]!.modifierId).toBe('mod_positive');
      if (affixes.length === 2) {
        expect(affixes[1]!.modifierId).toBe('mod_negative');
        withNegative++;
      } else {
        withoutNegative++;
      }
    }
    // При шансе 0.5 на 50 seed'ах оба исхода практически гарантированы.
    expect(withNegative).toBeGreaterThan(0);
    expect(withoutNegative).toBeGreaterThan(0);
  });

  it('значение роллится из рейнжа уровня предмета', () => {
    initWithModifiers([mockModifier('mod_a')]);

    const level1 = rollItemAffixes(createRNG(7), mockWeapon('sword', { level: 1 }));
    expect(level1[0]!.value).toBeGreaterThanOrEqual(1);
    expect(level1[0]!.value).toBeLessThanOrEqual(2);

    const level2 = rollItemAffixes(createRNG(7), mockWeapon('sword', { level: 2 }));
    expect(level2[0]!.value).toBeGreaterThanOrEqual(3);
    expect(level2[0]!.value).toBeLessThanOrEqual(4);
  });

  it('уровень выше длины ranges клампится к последнему рейнжу', () => {
    initWithModifiers([mockModifier('mod_a')]);
    const affixes = rollItemAffixes(createRNG(7), mockWeapon('sword', { level: 99 }));
    expect(affixes[0]!.value).toBeGreaterThanOrEqual(3);
    expect(affixes[0]!.value).toBeLessThanOrEqual(4);
  });

  it('scaling none даёт value = null', () => {
    initWithModifiers([mockModifier('mod_rule', { scaling: { kind: 'none' } })]);
    const affixes = rollItemAffixes(createRNG(7), mockWeapon('sword'));
    expect(affixes).toHaveLength(1);
    expect(affixes[0]!.value).toBeNull();
  });

  it('детерминирован по seed', () => {
    initWithModifiers([
      mockModifier('mod_positive'),
      mockModifier('mod_negative', { polarity: 'negative' }),
    ]);
    const sword = mockWeapon('sword', { level: 2 });

    const first = rollItemAffixes(createRNG(42), sword);
    const second = rollItemAffixes(createRNG(42), sword);
    expect(first).toEqual(second);
  });

  it('исключает модификатор, уже закреплённый в fixedModifiers шаблона', () => {
    initWithModifiers([
      mockModifier('mod_fixed'),
      mockModifier('mod_free'),
    ]);
    const sword = mockWeapon('sword', { fixedModifiers: ['mod_fixed'] });

    for (let seed = 1; seed <= 20; seed++) {
      const affixes = rollItemAffixes(createRNG(seed), sword);
      expect(affixes).toHaveLength(1);
      expect(affixes[0]!.modifierId).toBe('mod_free');
    }
  });

  it('исключает rule-модификатор, чей ruleId конфликтует с фирменным rule-модификатором', () => {
    initWithModifiers([
      mockModifier('mod_fixed_rule', {
        effect: { kind: 'rule', ruleId: 'test_rule' },
        scaling: { kind: 'none' },
        poolEligible: false,
      }),
      mockModifier('mod_conflicting_rule', {
        effect: { kind: 'rule', ruleId: 'test_rule' },
        scaling: { kind: 'none' },
      }),
    ]);
    const sword = mockWeapon('sword', { fixedModifiers: ['mod_fixed_rule'] });

    // Пул после исключения конфликтующего rule-модификатора пуст.
    for (let seed = 1; seed <= 20; seed++) {
      expect(rollItemAffixes(createRNG(seed), sword)).toEqual([]);
    }
  });

  it('не включает модификаторы с poolEligible: false в пул ролла', () => {
    initWithModifiers([
      mockModifier('mod_signature', { poolEligible: false }),
    ]);
    const sword = mockWeapon('sword');

    for (let seed = 1; seed <= 20; seed++) {
      expect(rollItemAffixes(createRNG(seed), sword)).toEqual([]);
    }
  });

  it('у ролленных аффиксов origin равен rolled', () => {
    initWithModifiers([mockModifier('mod_a')]);
    const affixes = rollItemAffixes(createRNG(7), mockWeapon('sword'));
    expect(affixes).toHaveLength(1);
    expect(affixes[0]!.origin).toBe('rolled');
  });
});

describe('buildFixedAffixes', () => {
  it('собирает фирменные аффиксы с origin fixed и значением из scaling fixed', () => {
    initWithModifiers([
      mockModifier('mod_signature', {
        scaling: { kind: 'fixed', value: 10 },
        poolEligible: false,
      }),
    ]);
    const sword = mockWeapon('sword', { fixedModifiers: ['mod_signature'] });

    expect(buildFixedAffixes(sword)).toEqual([
      { modifierId: 'mod_signature', value: 10, origin: 'fixed' },
    ]);
  });

  it('даёт value = null для модификатора со scaling none', () => {
    initWithModifiers([
      mockModifier('mod_rule', {
        effect: { kind: 'rule', ruleId: 'test_rule' },
        scaling: { kind: 'none' },
        poolEligible: false,
      }),
    ]);
    const sword = mockWeapon('sword', { fixedModifiers: ['mod_rule'] });

    expect(buildFixedAffixes(sword)).toEqual([
      { modifierId: 'mod_rule', value: null, origin: 'fixed' },
    ]);
  });

  it('сохраняет порядок fixedModifiers шаблона и пропускает неизвестные id', () => {
    initWithModifiers([
      mockModifier('mod_a', { scaling: { kind: 'fixed', value: 1 }, poolEligible: false }),
      mockModifier('mod_b', { scaling: { kind: 'fixed', value: 2 }, poolEligible: false }),
    ]);
    const sword = mockWeapon('sword', { fixedModifiers: ['mod_b', 'mod_missing', 'mod_a'] });

    expect(buildFixedAffixes(sword)).toEqual([
      { modifierId: 'mod_b', value: 2, origin: 'fixed' },
      { modifierId: 'mod_a', value: 1, origin: 'fixed' },
    ]);
  });
});

describe('createItemAffixes', () => {
  it('возвращает фирменные аффиксы первыми, за ними — ролленные', () => {
    initWithModifiers([
      mockModifier('mod_signature', {
        scaling: { kind: 'fixed', value: 10 },
        poolEligible: false,
      }),
      mockModifier('mod_pool'),
    ]);
    const sword = mockWeapon('sword', { fixedModifiers: ['mod_signature'] });

    const affixes = createItemAffixes(createRNG(7), sword);
    expect(affixes).toHaveLength(2);
    expect(affixes[0]).toEqual({ modifierId: 'mod_signature', value: 10, origin: 'fixed' });
    expect(affixes[1]!.modifierId).toBe('mod_pool');
    expect(affixes[1]!.origin).toBe('rolled');
  });
});
