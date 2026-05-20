/**
 * Кеш текстур PixiJS v8.
 *
 * В v8 Texture.from() не загружает изображения по URL.
 * Используем Assets.load() с кешированием.
 */

import {Assets, Texture} from 'pixi.js';

const cache = new Map<string, Texture>();
const pending = new Map<string, Promise<Texture>>();

export async function getTexture(url: string): Promise<Texture> {
  const cached = cache.get(url);
  if (cached) return cached;

  const existing = pending.get(url);
  if (existing) return existing;

  const promise = Assets.load<Texture>(url).then((texture) => {
    cache.set(url, texture);
    pending.delete(url);
    return texture;
  });

  pending.set(url, promise);
  return promise;
}

export function hasTexture(url: string): boolean {
  return cache.has(url);
}

export function clearTextures(): void {
  for (const texture of cache.values()) {
    texture.destroy(true);
  }
  cache.clear();
  pending.clear();
}
