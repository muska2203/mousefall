/**
 * Предзагрузчик игровых ассетов.
 *
 * Загружает манифест ассетов и прогревает кеш текстур PixiJS
 * до первого рендера игрового мира. Все ошибки отдельных файлов
 * логируются как warning — приложение не падает из-за одного пропущенного ассета.
 */

import {getTexture} from './TextureCache';

const ASSET_MANIFEST_PATH = '/assets/manifest.json';

/**
 * Загружает манифест ассетов и возвращает массив URL.
 */
export async function loadAssetManifest(): Promise<string[]> {
  const response = await fetch(ASSET_MANIFEST_PATH);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить манифест ассетов: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Манифест ассетов должен быть массивом строк URL');
  }

  return data as string[];
}

/**
 * Предзагружает список текстур в кеш.
 * Ошибки отдельных файлов логируются, но не прерывают загрузку остальных.
 */
export async function preloadTextures(urls: string[]): Promise<void> {
  const results = await Promise.allSettled(urls.map((url) => getTexture(url)));

  let failed = 0;
  for (let i = 0; i < urls.length; i++) {
    const result = results[i];
    if (result === undefined) continue;
    if (result.status === 'rejected') {
      failed++;
      console.warn(`[assetPreloader] Не удалось предзагрузить ассет: ${urls[i]}`, result.reason);
    }
  }

  if (failed > 0) {
    console.warn(`[assetPreloader] Предзагружено ${urls.length - failed} из ${urls.length} ассетов (${failed} пропущено)`);
  }
}
