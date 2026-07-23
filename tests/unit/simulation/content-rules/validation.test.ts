import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateContentRuleReferences,
  validateContentRuleSemantics,
} from '@simulation/content-rules/validation';
import type { LoadedContent, ItemTemplate, AbilityTemplate, StatusTemplate, TileEffectTemplate, TileEffectStatusTemplate } from '@content/schemas';
import type { ContentRule } from '@simulation/content-rules/types';
import type { StatusEffectType } from '@simulation/core-types';
import { setContentRulesOverride } from '@simulation/content-rules/registry';

function mockStatusTemplate(id: string, ruleIds: string[] = []): StatusTemplate {
  return {
    id,
    ruleIds,
    statusCategory: 'generic',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
  };
}

function mockTileEffectTemplate(id: string, ruleIds: string[] = []): TileEffectTemplate {
  return {
    id,
    ruleIds,
    layer: 'cover',
    duration: 3,
    renderOrder: 1,
    blockedByTileEffects: [],
    mutuallyExclusiveWithTileEffects: [],
    canHaveStatus: [],
    durationDecreasesWhenHasStatus: [],
  };
}

function mockTileEffectStatusTemplate(id: string, ruleIds: string[] = []): TileEffectStatusTemplate {
  return {
    id,
    duration: 3,
    neverExpires: false,
    ruleIds,
    statusCategory: 'generic',
    categoryPriority: 0,
    mutuallyExclusiveWith: [],
    blockedBy: [],
    renderOrder: 1,
  };
}

function createContent(overrides: Partial<LoadedContent> = {}): LoadedContent {
  return {
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    // Production-правила ссылаются на burning, dazed, poisoned, wet и oiled;
    // water_applies_wet и oil_applies_oiled ссылаются на тайловые эффекты water и oil;
    // fire_damage_ignites_oil ссылается на тайловый эффект oil и тайловый статус burning.
    // Включаем их по умолчанию, чтобы unit-тесты семантики не получали ложных ошибок от существующих правил.
    statuses: new Map([
      ['burning', mockStatusTemplate('burning')],
      ['dazed', mockStatusTemplate('dazed')],
      ['poisoned', mockStatusTemplate('poisoned')],
      ['wet', mockStatusTemplate('wet')],
      ['oiled', mockStatusTemplate('oiled')],
    ]),
    tileEffects: new Map([
      ['water', mockTileEffectTemplate('water')],
      ['oil', mockTileEffectTemplate('oil')],
    ]),
    tileEffectStatuses: new Map([
      ['burning', mockTileEffectStatusTemplate('burning')],
    ]),
    maps: new Map(),
    stairs: new Map(),
    doors: new Map(),
    ...overrides,
  };
}

describe('validateContentRuleReferences', () => {
  it('проходит для пустых ruleIds', () => {
    expect(() => validateContentRuleReferences(createContent())).not.toThrow();
  });

  it('падает при неизвестном ruleId в предмете', () => {
    const content = createContent({
      items: new Map([['test_item', { id: 'test_item', ruleIds: ['unknown_rule'] } as ItemTemplate]]),
    });
    expect(() => validateContentRuleReferences(content)).toThrow('unknown_rule');
  });

  it('падает при неизвестном ruleId в способности', () => {
    const content = createContent({
      abilities: new Map([['test_ability', { id: 'test_ability', ruleIds: ['unknown_rule'] } as AbilityTemplate]]),
    });
    expect(() => validateContentRuleReferences(content)).toThrow('unknown_rule');
  });

  it('падает при неизвестном ruleId в статусе', () => {
    const content = createContent({
      statuses: new Map([['test_status', mockStatusTemplate('test_status', ['unknown_rule'])]]),
    });
    expect(() => validateContentRuleReferences(content)).toThrow('unknown_rule');
  });

  it('падает при неизвестном ruleId в тайловом эффекте', () => {
    const content = createContent({
      tileEffects: new Map([['test_tile_effect', mockTileEffectTemplate('test_tile_effect', ['unknown_rule'])]]),
    });
    expect(() => validateContentRuleReferences(content)).toThrow('unknown_rule');
  });

  it('падает при неизвестном ruleId в статусе тайлового эффекта', () => {
    const content = createContent({
      tileEffectStatuses: new Map([['test_tile_effect_status', mockTileEffectStatusTemplate('test_tile_effect_status', ['unknown_rule'])]]),
    });
    expect(() => validateContentRuleReferences(content)).toThrow('unknown_rule');
  });

  it('падает при дублировании ruleIds в шаблоне', () => {
    const content = createContent({
      items: new Map([
        ['test_item', { id: 'test_item', ruleIds: ['fire_damage_ignites', 'fire_damage_ignites'] } as ItemTemplate],
      ]),
    });
    expect(() => validateContentRuleReferences(content)).toThrow('дублирующийся');
  });

  it('проходит при корректных известных ruleIds', () => {
    const content = createContent({
      items: new Map([['test_item', { id: 'test_item', ruleIds: ['fire_damage_ignites'] } as ItemTemplate]]),
    });
    expect(() => validateContentRuleReferences(content)).not.toThrow();
  });
});

describe('validateContentRuleSemantics', () => {
  beforeEach(() => {
    setContentRulesOverride([]);
  });

  afterEach(() => {
    setContentRulesOverride(null);
  });

  it('проходит, когда applyStatus ссылается на существующий статус', () => {
    const rule: ContentRule = {
      id: 'test_apply_burning',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'applyStatus', statusType: 'burning', duration: 3 },
      target: { type: 'eventTarget' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    expect(validateContentRuleSemantics(createContent())).toEqual([]);
  });

  it('возвращает ошибку, когда applyStatus ссылается на отсутствующий статус', () => {
    const rule: ContentRule = {
      id: 'test_apply_unknown',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'applyStatus', statusType: 'unknown_status' as unknown as StatusEffectType, duration: 3 },
      target: { type: 'eventTarget' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_apply_unknown',
      field: 'effect.statusType',
      problem: expect.stringContaining('unknown_status'),
    });
  });

  it('возвращает ошибку, когда applyTileEffectStatus ссылается на отсутствующий статус', () => {
    const rule: ContentRule = {
      id: 'test_apply_unknown_tile_effect_status',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'applyTileEffectStatus', statusType: 'unknown_tile_status', duration: 3 },
      target: { type: 'eventTileEffect', effectType: 'oil' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_apply_unknown_tile_effect_status',
      field: 'effect.statusType',
      problem: expect.stringContaining('unknown_tile_status'),
    });
  });

  it('проходит, когда applyTileEffectStatus ссылается на существующий статус тайлового эффекта', () => {
    const rule: ContentRule = {
      id: 'test_apply_burning_to_oil',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'applyTileEffectStatus', statusType: 'burning', duration: 3 },
      target: { type: 'eventTileEffect', effectType: 'oil' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    expect(validateContentRuleSemantics(createContent())).toEqual([]);
  });

  it('возвращает ошибку, когда applyTileEffectStatus использует target.type !== eventTileEffect', () => {
    const rule: ContentRule = {
      id: 'test_apply_tile_effect_status_wrong_target',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'applyTileEffectStatus', statusType: 'burning', duration: 3 },
      target: { type: 'eventTarget' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_apply_tile_effect_status_wrong_target',
      field: 'target.type',
      problem: expect.stringContaining('eventTileEffect'),
    });
  });

  it('возвращает ошибку, когда applyTileEffectStatus ссылается на отсутствующий тайловый эффект', () => {
    const rule: ContentRule = {
      id: 'test_apply_tile_effect_status_unknown_effect',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'applyTileEffectStatus', statusType: 'burning', duration: 3 },
      target: { type: 'eventTileEffect', effectType: 'unknown_tile_effect' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_apply_tile_effect_status_unknown_effect',
      field: 'target.effectType',
      problem: expect.stringContaining('unknown_tile_effect'),
    });
  });

  it('возвращает ошибку, когда inTileEffect ссылается на отсутствующий тайловый эффект', () => {
    const rule: ContentRule = {
      id: 'test_in_unknown_tile_effect',
      trigger: { event: 'ENTITY_DAMAGED' },
      conditions: [{ type: 'inTileEffect', effectType: 'unknown_tile_effect' }],
      effect: { type: 'restoreAp' },
      target: { type: 'self' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_in_unknown_tile_effect',
      field: 'condition.effectType',
      problem: expect.stringContaining('unknown_tile_effect'),
    });
  });

  it('возвращает ошибку, когда tileEffectHasStatus ссылается на отсутствующий тайловый эффект', () => {
    const rule: ContentRule = {
      id: 'test_tile_effect_has_unknown_effect',
      trigger: { event: 'ENTITY_DAMAGED' },
      conditions: [{ type: 'tileEffectHasStatus', effectType: 'unknown_tile_effect', statusType: 'burning' }],
      effect: { type: 'restoreAp' },
      target: { type: 'self' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_tile_effect_has_unknown_effect',
      field: 'condition.effectType',
      problem: expect.stringContaining('unknown_tile_effect'),
    });
  });

  it('возвращает ошибку, когда tileEffectHasStatus ссылается на отсутствующий статус тайлового эффекта', () => {
    const rule: ContentRule = {
      id: 'test_tile_effect_has_unknown_status',
      trigger: { event: 'ENTITY_DAMAGED' },
      conditions: [{ type: 'tileEffectHasStatus', effectType: 'oil', statusType: 'unknown_status' }],
      effect: { type: 'restoreAp' },
      target: { type: 'self' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_tile_effect_has_unknown_status',
      field: 'condition.statusType',
      problem: expect.stringContaining('unknown_status'),
    });
  });

  it('возвращает ошибку, когда trigger.tags пустой', () => {
    const rule: ContentRule = {
      id: 'test_empty_trigger_tags',
      trigger: { event: 'ENTITY_DAMAGED', tags: [] },
      effect: { type: 'restoreAp' },
      target: { type: 'self' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_empty_trigger_tags',
      field: 'trigger.tags',
    });
  });

  it('возвращает ошибку, когда условие hasTag содержит пустой тег', () => {
    const rule: ContentRule = {
      id: 'test_empty_condition_tag',
      trigger: { event: 'ENTITY_DAMAGED' },
      conditions: [{ type: 'hasTag', tag: '' } as unknown as NonNullable<ContentRule['conditions']>[number]],
      effect: { type: 'restoreAp' },
      target: { type: 'self' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_empty_condition_tag',
      field: 'condition.tag',
    });
  });

  it('проходит, когда dealDamage.damageFormulaId ссылается на существующую формулу', () => {
    const rule: ContentRule = {
      id: 'test_damage_formula',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'dealDamage', amount: 5, damageFormulaId: 'sword' } as unknown as ContentRule['effect'],
      target: { type: 'eventTarget' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    expect(validateContentRuleSemantics(createContent())).toEqual([]);
  });

  it('возвращает ошибку, когда dealDamage.damageFormulaId ссылается на отсутствующую формулу', () => {
    const rule: ContentRule = {
      id: 'test_damage_unknown_formula',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'dealDamage', amount: 5, damageFormulaId: 'unknown_formula' } as unknown as ContentRule['effect'],
      target: { type: 'eventTarget' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_damage_unknown_formula',
      field: 'effect.damageFormulaId',
      problem: expect.stringContaining('unknown_formula'),
    });
  });

  it('возвращает ошибку, когда durationDecreasesWhenHasStatus ссылается на отсутствующий статус тайлового эффекта', () => {
    const base = createContent();
    const tileEffects = new Map(base.tileEffects);
    tileEffects.set('oil', {
      ...mockTileEffectTemplate('oil'),
      durationDecreasesWhenHasStatus: ['unknown_status'],
    });
    const content = createContent({ tileEffects });

    const errors = validateContentRuleSemantics(content);
    const tileEffectError = errors.find((e) => e.path.startsWith('tileEffect.oil.durationDecreasesWhenHasStatus'));
    expect(tileEffectError).toBeDefined();
    expect(tileEffectError).toMatchObject({
      path: 'tileEffect.oil.durationDecreasesWhenHasStatus[0]',
      field: 'durationDecreasesWhenHasStatus',
      problem: expect.stringContaining('unknown_status'),
    });
  });

  it('проходит, когда durationDecreasesWhenHasStatus ссылается на существующий статус тайлового эффекта', () => {
    const base = createContent();
    const tileEffects = new Map(base.tileEffects);
    tileEffects.set('oil', {
      ...mockTileEffectTemplate('oil'),
      durationDecreasesWhenHasStatus: ['burning'],
    });
    const content = createContent({ tileEffects });

    expect(validateContentRuleSemantics(content)).toEqual([]);
  });
});
