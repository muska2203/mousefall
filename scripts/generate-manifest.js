/**
 * Генератор манифеста контента.
 *
 * Сканирует public/content/, находит все JSON-файлы
 * и формирует public/content/manifest.json.
 *
 * Запускать перед dev/build:
 *   node scripts/generate-manifest.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_DIR = path.resolve(__dirname, '../public/content');
const MANIFEST_PATH = path.join(CONTENT_DIR, 'manifest.json');

/** Сопоставление подпапок → ключи манифеста */
const CATEGORY_MAP = {
  'entities/enemies': 'entities',
  'entities/player': 'players',
  'entities/stairs': 'stairs',
  'entities/doors': 'doors',
  items: 'items',
  abilities: 'abilities',
  statuses: 'statuses',
  maps: 'maps',
};

function scanDir(dir, baseDir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, baseDir, result);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (relativePath !== 'manifest.json') {
        result.push(relativePath);
      }
    }
  }
  return result;
}

function categorize(files) {
  const manifest = {
    entities: [],
    players: [],
    items: [],
    abilities: [],
    statuses: [],
    maps: [],
    stairs: [],
    doors: [],
  };

  for (const file of files.sort()) {
    const unixPath = file.replace(/\\/g, '/');
    const matchedKey = Object.keys(CATEGORY_MAP).find((prefix) =>
      unixPath.startsWith(prefix + '/')
    );

    if (matchedKey) {
      const manifestKey = CATEGORY_MAP[matchedKey];
      manifest[manifestKey].push('/content/' + unixPath);
    } else {
      console.warn(`[generate-manifest] Предупреждение: файл не попал ни в одну категорию: ${unixPath}`);
    }
  }

  return manifest;
}

function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`[generate-manifest] Ошибка: папка не найдена ${CONTENT_DIR}`);
    process.exit(1);
  }

  const files = scanDir(CONTENT_DIR, CONTENT_DIR);
  const manifest = categorize(files);

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  const total = Object.values(manifest).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`[generate-manifest] Манифест обновлён: ${total} файлов → ${MANIFEST_PATH}`);
}

main();
