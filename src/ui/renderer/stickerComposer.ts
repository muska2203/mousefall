/**
 * Композитор sticker-HP рамок для сущностей.
 *
 * Склеивает base-спрайт и frame-ассет: магическая зона frame перекрашивается
 * в цвета фракции в зависимости от HP, поверх накладывается base.
 *
 * Результат кэшируется по (basePath, framePath, factionId, hpPixels).
 */

import {Texture} from 'pixi.js';
import {getTexture} from './TextureCache';
import {FACTION_STICKER_COLORS, STICKER_HP_MAGIC_COLOR} from '@utils/constants';
import type {FactionId} from '@presentation/types';

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const MAGIC_R = (STICKER_HP_MAGIC_COLOR >> 16) & 0xff;
const MAGIC_G = (STICKER_HP_MAGIC_COLOR >> 8) & 0xff;
const MAGIC_B = STICKER_HP_MAGIC_COLOR & 0xff;

const boundsCache = new Map<string, Bounds | null>();
const textureCache = new Map<string, Texture>();
const pending = new Map<string, Promise<Texture | null>>();

/** Рабочий canvas для чтения/перекраски frame. Создаётся лениво, чтобы модуль не обращался к DOM при загрузке в Node. */
let workCanvas: HTMLCanvasElement | null = null;
let workCtx: CanvasRenderingContext2D | null = null;

function getWorkContext(): CanvasRenderingContext2D | null {
  if (!workCtx) {
    workCanvas = document.createElement('canvas');
    workCtx = workCanvas.getContext('2d', {willReadFrequently: true});
  }
  return workCtx;
}

function frameKey(basePath: string, framePath: string): string {
  return `${basePath}|${framePath}`;
}

function cacheKey(basePath: string, framePath: string, factionId: string, hpPixels: number): string {
  return `${basePath}|${framePath}|${factionId}|${hpPixels}`;
}

function isMagicPixel(data: Uint8ClampedArray, index: number): boolean {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const a = data[index + 3];
  return (
    r === MAGIC_R &&
    g === MAGIC_G &&
    b === MAGIC_B &&
    a !== undefined &&
    a > 0
  );
}

function readMagicBounds(frameImage: CanvasImageSource, width: number, height: number): Bounds | null {
  const ctx = getWorkContext();
  if (!ctx || !workCanvas) return null;
  workCanvas.width = width;
  workCanvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(frameImage, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!isMagicPixel(data, i)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return {minX, minY, maxX, maxY};
}

function splitColor(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function recolorFrame(
  frameImage: CanvasImageSource,
  width: number,
  height: number,
  bounds: Bounds,
  hpPixels: number,
  primary: number,
  secondary: number,
): HTMLCanvasElement {
  const ctx = getWorkContext();
  if (!ctx || !workCanvas) {
    throw new Error('StickerComposer: failed to get 2d context');
  }

  workCanvas.width = width;
  workCanvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(frameImage, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const [pr, pg, pb] = splitColor(primary);
  const [sr, sg, sb] = splitColor(secondary);

  // Граница между primary (низ) и secondary (верх).
  const splitY = bounds.maxY - hpPixels + 1;

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const i = (y * width + x) * 4;
      if (!isMagicPixel(data, i)) continue;
      const isPrimary = y >= splitY;
      data[i] = isPrimary ? pr : sr;
      data[i + 1] = isPrimary ? pg : sg;
      data[i + 2] = isPrimary ? pb : sb;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return workCanvas;
}

function composeSprite(
  baseImage: CanvasImageSource,
  coloredFrame: HTMLCanvasElement,
  width: number,
  height: number,
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('StickerComposer: failed to get 2d context');
  }
  ctx.drawImage(coloredFrame, 0, 0);
  ctx.drawImage(baseImage, 0, 0);
  return Texture.from(canvas, true);
}

/**
 * Вернуть готовую sticker-текстуру для сущности.
 * Если frame-ассет отсутствует или не содержит магического цвета — вернёт null.
 */
export async function getStickerTexture(
  basePath: string,
  framePath: string,
  factionId: FactionId,
  hpRatio: number,
): Promise<Texture | null> {
  const colors = FACTION_STICKER_COLORS[factionId];
  if (!colors) return null;

  let baseTexture: Texture;
  let frameTexture: Texture;
  try {
    [baseTexture, frameTexture] = await Promise.all([getTexture(basePath), getTexture(framePath)]);
  } catch {
    return null;
  }

  const baseImage = baseTexture.source.resource as CanvasImageSource;
  const frameImage = frameTexture.source.resource as CanvasImageSource;
  const width = frameTexture.width || frameTexture.source.width;
  const height = frameTexture.height || frameTexture.source.height;

  const fKey = frameKey(basePath, framePath);
  let bounds = boundsCache.get(fKey);
  if (bounds === undefined) {
    bounds = readMagicBounds(frameImage, width, height);
    boundsCache.set(fKey, bounds);
  }
  if (!bounds) return null;

  const bboxHeight = bounds.maxY - bounds.minY + 1;
  const hpPixels = Math.max(0, Math.min(bboxHeight, Math.round(hpRatio * bboxHeight)));
  const key = cacheKey(basePath, framePath, factionId, hpPixels);

  const cached = textureCache.get(key);
  if (cached) return cached;

  const existing = pending.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<Texture | null> => {
    try {
      const coloredFrame = recolorFrame(
        frameImage,
        width,
        height,
        bounds!,
        hpPixels,
        colors.primary,
        colors.secondary,
      );
      const texture = composeSprite(baseImage, coloredFrame, width, height);
      textureCache.set(key, texture);
      return texture;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, promise);
  return promise;
}

/** Уничтожить все созданные sticker-текстуры и сбросить кэши. */
export function clearStickerTextures(): void {
  for (const texture of textureCache.values()) {
    texture.destroy(true);
  }
  textureCache.clear();
  boundsCache.clear();
  pending.clear();
}
