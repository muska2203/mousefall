import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateContentRuleReferences,
  validateContentRuleSemantics,
} from '@simulation/content-rules/validation';
import type { LoadedContent, ItemTemplate, AbilityTemplate, StatusTemplate } from '@content/schemas';
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

function mockAbilityTemplate(id: string, ruleIds: string[] = []): AbilityTemplate {
  return {
    id,
    ruleIds,
    cooldown: 0,
    apCost: 1,
    aiPreparable: false,
    requiredWeaponTags: [],
    tags: [],
  };
}

function createContent(overrides: Partial<LoadedContent> = {}): LoadedContent {
  return {
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    // Production-правила ссылаются на burning, dazed и poisoned; включаем их по умолчанию,
    // чтобы unit-тесты семантики не получали ложных ошибок от существующих правил.
    statuses: new Map([
      ['burning', mockStatusTemplate('burning')],
      ['dazed', mockStatusTemplate('dazed')],
      ['poisoned', mockStatusTemplate('poisoned')],
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

  it('проходит, когда counterAttack.skillId ссылается на существующую способность', () => {
    const rule: ContentRule = {
      id: 'test_counter_with_skill',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'counterAttack', skillId: 'cleave' } as unknown as ContentRule['effect'],
      target: { type: 'eventSource' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const content = createContent({
      abilities: new Map([['cleave', mockAbilityTemplate('cleave')]]),
    });

    expect(validateContentRuleSemantics(content)).toEqual([]);
  });

  it('возвращает ошибку, когда counterAttack.skillId ссылается на отсутствующую способность', () => {
    const rule: ContentRule = {
      id: 'test_counter_unknown_skill',
      trigger: { event: 'ENTITY_DAMAGED' },
      effect: { type: 'counterAttack', skillId: 'missing_skill' } as unknown as ContentRule['effect'],
      target: { type: 'eventSource' },
      priority: 0,
    };
    setContentRulesOverride([rule]);

    const errors = validateContentRuleSemantics(createContent());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      ruleId: 'test_counter_unknown_skill',
      field: 'effect.skillId',
      problem: expect.stringContaining('missing_skill'),
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
});
