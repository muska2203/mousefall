import { describe, it, expect } from 'vitest';
import {
  getContentRule,
  tryGetContentRule,
  getAllContentRules,
  getRegistry,
} from '@simulation/content-rules/registry';

describe('content-rules registry', () => {
  it('находит правило по ruleId', () => {
    const rule = getContentRule('fire_damage_ignites');
    expect(rule.id).toBe('fire_damage_ignites');
    expect(rule.trigger.event).toBe('ENTITY_DAMAGED');
  });

  it('возвращает undefined для неизвестного ruleId', () => {
    expect(tryGetContentRule('unknown_rule')).toBeUndefined();
  });

  it('выбрасывает исключение для неизвестного ruleId при getContentRule', () => {
    expect(() => getContentRule('unknown_rule')).toThrow('unknown_rule');
  });

  it('все ruleIds уникальны', () => {
    const ids = getAllContentRules().map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getRegistry содержит все правила', () => {
    expect(getRegistry().size).toBe(getAllContentRules().length);
  });
});
