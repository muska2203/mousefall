/**
 * Генератор манифеста ассетов.
 *
 * Сканирует public/assets/, находит все файлы и формирует
 * public/assets/manifest.json — плоский массив URL вида /assets/... .
 *
 * Запускать перед dev/build:
 *   node scripts/generate-asset-manifest.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.resolve(__dirname, '../public/assets');
const MANIFEST_PATH = path.join(ASSETS_DIR, 'manifest.json');

/** Файлы и папки, которые не попадают в манифест. */
const EXCLUDED_NAMES = new Set(['manifest.json', 'AGENTS.md']);

function scanDir(dir, baseDir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, baseDir, result);
    } else if (entry.isFile() && !EXCLUDED_NAMES.has(entry.name)) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      result.push('/assets/' + relativePath);
    }
  }
  return result;
}

function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`[generate-asset-manifest] Ошибка: папка не найдена ${ASSETS_DIR}`);
    process.exit(1);
  }

  const urls = scanDir(ASSETS_DIR, ASSETS_DIR).sort();

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(urls, null, 2) + '\n', 'utf-8');

  console.log(`[generate-asset-manifest] Манифест обновлён: ${urls.length} файлов → ${MANIFEST_PATH}`);
}

main();
