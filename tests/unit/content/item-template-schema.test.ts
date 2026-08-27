/**
 * Тесты инвариантов ItemTemplateSchema (внутришаблонные проверки superRefine).
 */

import {describe, expect, it} from 'vitest';
import {ItemTemplateSchema} from '../../../src/content/schemas';

describe('ItemTemplateSchema: stackable', () => {
  const baseStackable = {
    id: 'test_stackable',
    type: 'consumable',
    stackable: true,
    maxStack: 5,
    consumable: { effect: 'heal', value: 5 },
  };

  it('отклоняет stackable-предмет с abilityPool: экземпляры с ролленными способностями не сливаются', () => {
    const result = ItemTemplateSchema.safeParse({
      ...baseStackable,
      abilityPool: [{ abilityId: 'dash', weight: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'abilityPool')).toBe(true);
    }
  });

  it('принимает stackable-предмет без abilityPool', () => {
    expect(ItemTemplateSchema.safeParse(baseStackable).success).toBe(true);
  });

  it('принимает нестакаемый предмет с abilityPool', () => {
    const result = ItemTemplateSchema.safeParse({
      ...baseStackable,
      stackable: false,
      abilityPool: [{ abilityId: 'dash', weight: 1 }],
    });

    expect(result.success).toBe(true);
  });
});
