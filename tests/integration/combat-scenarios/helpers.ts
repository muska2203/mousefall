/**
 * Хелперы для интеграционных боевых сценариев.
 *
 * Загружает реальный контент из `public/content/`, чтобы сценарии работали
 * с актуальными предметами, статусами и контентными правилами.
 */

import fs from 'fs';
import path from 'path';
import { loadAllContent } from '../../../src/content/loader';
import { resetRegistry } from '../../../src/content/registry';
import { initSkillRegistry } from '../../../src/simulation/skills';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'public/content');

/**
 * Загружает весь контент из `public/content/` в реестр.
 */
export async function loadTestContent(): Promise<void> {
  resetRegistry();
  await loadAllContent((manifestPath) => {
    const relativePath = manifestPath.replace(/^\/content\//, '');
    const filePath = path.join(CONTENT_DIR, relativePath);
    return Promise.resolve(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  });
}

/**
 * Подготовка к сценарию: реестр скиллов и контента.
 */
export function setupCombatScenario(): void {
  initSkillRegistry();
}
