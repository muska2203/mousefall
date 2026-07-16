/**
 * Интеграционные тесты скрипта `scripts/validate-content.ts`.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_SCRIPT_COMMAND = 'npm run validate:content';
const SOURCE_CONTENT_DIR = path.join(PROJECT_ROOT, 'public/content');

function runValidate(options: { contentDir?: string } = {}): { status: number; output: string } {
  const env = options.contentDir
    ? { ...process.env, VALIDATE_CONTENT_DIR: path.relative(PROJECT_ROOT, options.contentDir) }
    : process.env;

  try {
    const output = execSync(DEFAULT_SCRIPT_COMMAND, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
      env,
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

function createTempContentDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mousefall-content-'));
  fs.cpSync(SOURCE_CONTENT_DIR, tempDir, { recursive: true });
  return tempDir;
}

describe('validate-content script', () => {
  it('проходит на текущем контенте с кодом 0', () => {
    const { status, output } = runValidate();
    expect(status).toBe(0);
    expect(output).toContain('OK: весь контент валиден');
  });

  it('падает с кодом 1, если добавить несуществующий ruleId', () => {
    const tempDir = createTempContentDir();
    try {
      const counterattackPath = path.join(tempDir, 'statuses/counterattack.json');
      const parsed = JSON.parse(fs.readFileSync(counterattackPath, 'utf-8'));
      parsed.ruleIds = [...parsed.ruleIds, 'nonexistent_rule_for_validation_test'];
      fs.writeFileSync(counterattackPath, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');

      const { status, output } = runValidate({ contentDir: tempDir });

      expect(status).toBe(1);
      expect(output).toContain('nonexistent_rule_for_validation_test');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
