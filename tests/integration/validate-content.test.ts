/**
 * Интеграционные тесты скрипта `scripts/validate-content.ts`
 * и валидации ссылок на контентные правила.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

import { buildContent } from '../../src/content/templates';
import { validateContentRuleReferences } from '../../src/simulation/content-rules/validation';
import { validateContentReferences } from '../../src/content/validate-references';

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
});
