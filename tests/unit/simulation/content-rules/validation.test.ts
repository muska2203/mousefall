import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateContentRuleReferences,
  validateContentRuleSemantics,
} from '@simulation/content-rules/validation';
import type { LoadedContent, AbilityTemplate, StatusTemplate, TileEffectTemplate, TileEffectStatusTemplate, ModifierTemplate } from '@content/schemas';
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
    blocksLOS: false,
    concealsEntities: false,
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
    // правила мышеловки (mousetrap_apply_*) — на bleeding и rooted;
    // water_applies_wet и oil_applies_oiled ссылаются на тайловые эффекты water и oil;
    // fire_damage_ignites_oil ссылается на тайловый эффект oil и тайловый статус burning;
    // правила муки (fire_*_ignites_flour, prop_contains_flour_*) — на flour_cloud.
    // Включаем их по умолчанию, чтобы unit-тесты семантики не получали ложных ошибок от существующих правил.
    statuses: new Map([
      ['burning', mockStatusTemplate('burning')],
      ['dazed', mockStatusTemplate('dazed')],
      ['poisoned', mockStatusTemplate('poisoned')],
      ['wet', mockStatusTemplate('wet')],
      ['oiled', mockStatusTemplate('oiled')],
      ['bleeding', mockStatusTemplate('bleeding')],
      ['rooted', mockStatusTemplate('rooted')],
    ]),
    tileEffects: new Map([
      ['water', mockTileEffectTemplate('water')],
      ['oil', mockTileEffectTemplate('oil')],
      ['flour_cloud', mockTileEffectTemplate('flour_cloud')],
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

  it('падает при неизвестном ruleId в rule-модификаторе', () => {
    const content = createContent({
      modifiers: new Map([['mod_test', {
        id: 'mod_test',
        effect: { kind: 'rule', ruleId: 'unknown_rule' },
        scaling: { kind: 'none' },
        applicableSubtypes: ['light'],
        polarity: 'positive',
        poolEligible: false,
        weight: 1,
      } as ModifierTemplate]]),
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
      abilities: new Map([
        ['test_ability', { id: 'test_ability', ruleIds: ['fire_damage_ignites', 'fire_damage_ignites'] } as AbilityTemplate],
      ]),
    });
    expect(() => validateContentRuleReferences(content)).toThrow('дублирующийся');
  });

  it('проходит при корректном ruleId в rule-модификаторе', () => {
    const content = createContent({
      modifiers: new Map([['mod_test', {
        id: 'mod_test',
        effect: { kind: 'rule', ruleId: 'fire_damage_ignites' },
        scaling: { kind: 'none' },
        applicableSubtypes: ['light'],
        polarity: 'positive',
        poolEligible: false,
        weight: 1,
      } as ModifierTemplate]]),
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

  it('проходит, когда spawnTileEffect ссылается на существующий тайловый эффект и positionsInRadius', () => {
    const rule: ContentRule = {
      id: 'test_spawn_oil',
      trigger: { event: 'ENTITY_DIED' },
      effect: { type: 'spawnTileEffect', effectType: 'oil' },
      target: { type: 'positionsInRadius', radius: 1, center: 'eventPosition' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    expect(validateContentRuleSemantics(createContent())).toEqual([]);
  });

  it('возвращает ошибку, когда spawnTileEffect ссылается на отсутствующий тайловый эффект', () => {
    const rule: ContentRule = {
      id: 'test_spawn_unknown_tile_effect',
      trigger: { event: 'ENTITY_DIED' },
      effect: { type: 'spawnTileEffect', effectType: 'unknown_tile_effect' },
      target: { type: 'positionsInRadius', radius: 1, center: 'eventPosition' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_spawn_unknown_tile_effect',
      field: 'effect.effectType',
      problem: expect.stringContaining('unknown_tile_effect'),
    });
  });

  it('возвращает ошибку, когда spawnTileEffect использует target.type !== positionsInRadius', () => {
    const rule: ContentRule = {
      id: 'test_spawn_tile_effect_wrong_target',
      trigger: { event: 'ENTITY_DIED' },
      effect: { type: 'spawnTileEffect', effectType: 'oil' },
      target: { type: 'eventTarget' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_spawn_tile_effect_wrong_target',
      field: 'target.type',
      problem: expect.stringContaining('positionsInRadius'),
    });
  });
});

describe('validateModifierTemplates (семантика аффиксов)', () => {
  beforeEach(() => {
    setContentRulesOverride([]);
  });

  afterEach(() => {
    setContentRulesOverride(null);
  });

  function mockModifier(overrides: Partial<ModifierTemplate> = {}): ModifierTemplate {
    return {
      id: 'mod_test',
      polarity: 'positive',
      effect: { kind: 'stat', stat: 'armor', op: 'add' },
      scaling: { kind: 'perLevel', ranges: [{ min: 1, max: 2 }] },
      applicableSubtypes: ['light'],
      poolEligible: true,
      weight: 1,
      ...overrides,
    };
  }

  it('возвращает ошибку для stat-аффикса со scaling none (модификатор применился бы со значением 0)', () => {
    const content = createContent({
      modifiers: new Map([['mod_test', mockModifier({ scaling: { kind: 'none' } })]]),
    });

    const errors = validateContentRuleSemantics(content);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      path: 'modifiers.mod_test',
      field: 'scaling',
      problem: expect.stringContaining('perLevel'),
    });
  });

  it('проходит для stat-аффикса со scaling perLevel', () => {
    const content = createContent({
      modifiers: new Map([['mod_test', mockModifier()]]),
    });

    expect(validateContentRuleSemantics(content)).toEqual([]);
  });

  it('проходит для stat-аффикса со scaling fixed (детерминированное значение)', () => {
    const content = createContent({
      modifiers: new Map([['mod_test', mockModifier({
        scaling: { kind: 'fixed', value: 10 },
        poolEligible: false,
      })]]),
    });

    expect(validateContentRuleSemantics(content)).toEqual([]);
  });

  it('проходит для rule-аффикса со scaling none без ownerParam в правиле', () => {
    const rule: ContentRule = {
      id: 'test_rule_no_owner_param',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'dealDamage', amount: 2 },
      target: { type: 'eventTarget' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const content = createContent({
      modifiers: new Map([['mod_test', mockModifier({
        effect: { kind: 'rule', ruleId: 'test_rule_no_owner_param' },
        scaling: { kind: 'none' },
      })]]),
    });

    expect(validateContentRuleSemantics(content)).toEqual([]);
  });

  it('возвращает ошибку для rule-аффикса со scaling perLevel, если в правиле нет ownerParam', () => {
    const rule: ContentRule = {
      id: 'test_rule_no_owner_param',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'dealDamage', amount: 2 },
      target: { type: 'eventTarget' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const content = createContent({
      modifiers: new Map([['mod_test', mockModifier({
        effect: { kind: 'rule', ruleId: 'test_rule_no_owner_param' },
      })]]),
    });

    const errors = validateContentRuleSemantics(content);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      path: 'modifiers.mod_test',
      field: 'scaling',
      problem: expect.stringContaining('ownerParam'),
    });
  });

  it('проходит для rule-аффикса со scaling perLevel, если правило использует ownerParam', () => {
    const rule: ContentRule = {
      id: 'test_rule_with_owner_param',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'dealDamage', amount: { type: 'ownerParam' } },
      target: { type: 'eventTarget' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const content = createContent({
      modifiers: new Map([['mod_test', mockModifier({
        effect: { kind: 'rule', ruleId: 'test_rule_with_owner_param' },
      })]]),
    });

    expect(validateContentRuleSemantics(content)).toEqual([]);
  });
});
