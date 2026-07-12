import { describe, it, expect } from 'vitest';
import { validateContentRuleReferences } from '@simulation/content-rules/validation';
import type { LoadedContent, ItemTemplate, AbilityTemplate, StatusTemplate } from '@content/schemas';

function createContent(overrides: Partial<LoadedContent> = {}): LoadedContent {
  return {
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    statuses: new Map(),
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
      statuses: new Map([['test_status', { id: 'test_status', ruleIds: ['unknown_rule'] } as StatusTemplate]]),
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
