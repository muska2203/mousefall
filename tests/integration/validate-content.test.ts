/**
 * Интеграционные тесты скрипта `scripts/validate-content.ts`
 * и валидации ссылок на контентные правила.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

import { buildContent } from '../../src/content/templates';
import { validateContentRuleReferences } from '../../src/simulation/content-rules/validation';
import { validateContentReferences, validateModifierTextPlaceholders } from '../../src/content/validate-references';
import type { LoadedContent, ItemTemplate, ModifierTemplate } from '../../src/content/schemas';
import type { ContentTexts } from '../../src/content/texts/types';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_SCRIPT_COMMAND = 'npm run validate:content';

function runValidate(): { status: number; output: string } {
  try {
    const output = execSync(DEFAULT_SCRIPT_COMMAND, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { status: 0, output };
  } catch (err) {
    const error = err as { status: number; stdout?: string; stderr?: string };
    const stdout = typeof error.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr : '';
    return {
      status: error.status,
      output: stdout + stderr,
    };
  }
}

describe('validate-content script', () => {
  it('проходит на текущем контенте с кодом 0', () => {
    const { status, output } = runValidate();
    expect(status).toBe(0);
    expect(output).toContain('OK: весь контент валиден');
  });

  it('валидация ссылок падает, если у шаблона несуществующий ruleId', () => {
    const content = buildContent();
    const counterattack = content.statuses.get('counterattack');
    expect(counterattack).toBeDefined();

    // Клонируем шаблон с битым ruleId и проверяем, что валидация его находит.
    content.statuses.set('counterattack', {
      ...counterattack!,
      ruleIds: [...counterattack!.ruleIds, 'nonexistent_rule_for_validation_test'],
    });

    expect(() => validateContentRuleReferences(content)).toThrow(/nonexistent_rule_for_validation_test/);
  });

  it('валидация ссылок между шаблонами находит несуществующий templateId в lootTable', () => {
    const content = buildContent();
    const catSmall = content.entities.get('cat_small');
    expect(catSmall).toBeDefined();

    // Клонируем шаблон с битой ссылкой на предмет и проверяем, что валидация её находит.
    content.entities.set('cat_small', {
      ...catSmall!,
      lootTable: [...catSmall!.lootTable, { templateId: 'nonexistent_item_for_validation_test', weight: 1 }],
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'entities.cat_small' &&
      e.field === 'lootTable[].templateId' &&
      e.problem.includes('nonexistent_item_for_validation_test'),
    )).toBe(true);
  });

  it('находит плейсхолдер {value} в описании аффикса со scaling none', () => {
    const content = buildContent();
    // mod_poison_on_hit — rule-аффикс со scaling 'none' (ролленного значения нет).
    expect(content.modifiers?.get('mod_poison_on_hit')?.scaling.kind).toBe('none');

    const texts = {
      modifiers: {
        mod_poison_on_hit: { name: 'Тест', description: 'Отравление на {value} ходов' },
      },
    } as unknown as ContentTexts;

    const errors = validateModifierTextPlaceholders(content, { ru: texts, en: texts });
    expect(errors.some((e) =>
      e.path === 'modifiers.mod_poison_on_hit' &&
      e.field === 'description' &&
      e.problem.includes('{value}'),
    )).toBe(true);
  });

  it('пропускает плейсхолдер {value} в описании аффикса со scaling perLevel', () => {
    const content = buildContent();
    // mod_sturdy_armor — stat-аффикс со scaling 'perLevel' (значение роллится).
    expect(content.modifiers?.get('mod_sturdy_armor')?.scaling.kind).toBe('perLevel');

    const texts = {
      modifiers: {
        mod_sturdy_armor: { name: 'Тест', description: '+{value} к броне' },
      },
    } as unknown as ContentTexts;

    expect(validateModifierTextPlaceholders(content, { ru: texts, en: texts })).toEqual([]);
  });

  it('пропускает плейсхолдер {value} в описании аффикса со scaling fixed', () => {
    const content = buildContent();
    // mod_guardian_vitality — stat-аффикс со scaling 'fixed' (детерминированное значение).
    expect(content.modifiers?.get('mod_guardian_vitality')?.scaling.kind).toBe('fixed');

    const texts = {
      modifiers: {
        mod_guardian_vitality: { name: 'Тест', description: 'Максимум здоровья: +{value}.' },
      },
    } as unknown as ContentTexts;

    expect(validateModifierTextPlaceholders(content, { ru: texts, en: texts })).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Фирменные модификаторы предметов (fixedModifiers)
// ─────────────────────────────────────────────

/** Минимальный синтетический контент для проверок fixedModifiers. */
function makeSyntheticContent(overrides: Partial<LoadedContent>): LoadedContent {
  return {
    entities: new Map(),
    players: new Map(),
    items: new Map(),
    abilities: new Map(),
    maps: new Map(),
    stairs: new Map(),
    doors: new Map(),
    statuses: new Map(),
    tileEffects: new Map(),
    tileEffectStatuses: new Map(),
    ...overrides,
  } as LoadedContent;
}

function mockModifier(overrides: Partial<ModifierTemplate> = {}): ModifierTemplate {
  return {
    id: 'mod_test',
    effect: { kind: 'stat', stat: 'maxHp', op: 'add' },
    scaling: { kind: 'fixed', value: 10 },
    applicableSubtypes: ['sword'],
    polarity: 'positive',
    poolEligible: false,
    weight: 1,
    ...overrides,
  } as ModifierTemplate;
}

function mockWeapon(overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id: 'test_sword',
    type: 'weapon',
    subtype: 'sword',
    stackable: false,
    maxStack: 1,
    value: 0,
    rarity: 'common',
    abilityPool: [],
    fixedModifiers: [],
    grantedAbilities: [],
    apCost: 1,
    ...overrides,
  } as ItemTemplate;
}

describe('validateContentReferences: fixedModifiers', () => {
  it('находит ссылку на несуществующий модификатор в fixedModifiers', () => {
    const content = makeSyntheticContent({
      items: new Map([['test_sword', mockWeapon({ fixedModifiers: ['nonexistent_mod'] })]]),
      modifiers: new Map(),
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'items.test_sword' &&
      e.field === 'fixedModifiers' &&
      e.problem.includes('nonexistent_mod'),
    )).toBe(true);
  });

  it('находит фирменный модификатор, неприменимый к подтипу предмета', () => {
    const content = makeSyntheticContent({
      items: new Map([['test_sword', mockWeapon({ fixedModifiers: ['mod_test'] })]]),
      modifiers: new Map([['mod_test', mockModifier({ applicableSubtypes: ['light'] })]]),
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'items.test_sword' &&
      e.field === 'fixedModifiers' &&
      e.problem.includes('mod_test'),
    )).toBe(true);
  });

  it('находит фирменный модификатор со scaling perLevel', () => {
    const content = makeSyntheticContent({
      items: new Map([['test_sword', mockWeapon({ fixedModifiers: ['mod_test'] })]]),
      modifiers: new Map([['mod_test', mockModifier({
        scaling: { kind: 'perLevel', ranges: [{ min: 1, max: 2 }] },
      })]]),
    });

    const errors = validateContentReferences(content);
    expect(errors.some((e) =>
      e.path === 'items.test_sword' &&
      e.field === 'fixedModifiers' &&
      e.problem.includes('perLevel'),
    )).toBe(true);
  });

  it('пропускает корректный фирменный модификатор', () => {
    const content = makeSyntheticContent({
      items: new Map([['test_sword', mockWeapon({ fixedModifiers: ['mod_test'] })]]),
      modifiers: new Map([['mod_test', mockModifier()]]),
    });

    expect(validateContentReferences(content)).toEqual([]);
  });
});
