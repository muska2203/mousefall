/**
 * Debug-рендерер комнат и коридоров.
 *
 * Рисует поверх тайлов полупрозрачные прямоугольники комнат
 * и ломаные линии коридоров, чтобы визуально анализировать
 * результат процедурной генерации карты.
 */

import {Container, Graphics} from 'pixi.js';
import type {RenderInput} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';

const ROOM_FILL_ALPHA = 0.15;
const ROOM_STROKE_ALPHA = 0.6;
const ROOM_STROKE_WIDTH = 2;

const CORRIDOR_FILL_ALPHA = 0.25;
const CORRIDOR_STROKE_ALPHA = 0.7;
const CORRIDOR_STROKE_WIDTH = 2;

// Типы берём из RenderInput, чтобы renderer не зависел от simulation/types напрямую.
type Room = RenderInput['state']['map']['rooms'][number];
type Corridor = RenderInput['state']['map']['corridors'][number];

/** Детерминированный цвет из координат/индекса (24-битное RGB). */
function hashColor(seed: number): number {
  let hash = seed >>> 0;
  hash = (hash * 2654435761) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  hash = (hash * 2246822507) >>> 0;
  hash = (hash ^ (hash >>> 13)) >>> 0;
  // Исключаем слишком тёмные оттенки, чтобы было видно на тайлах.
  return (hash & 0x7f7f7f) | 0x404040;
}

function colorForRoom(room: Room): number {
  const seed = room.x * 73856093 ^ room.y * 19349663 ^ room.width * 83492791 ^ room.height * 23452781;
  return hashColor(seed);
}

function colorForCorridor(index: number): number {
  return hashColor(index * 374761393 + 12345);
}

export class DebugMapRenderer {
  public readonly container = new Container();

  update(input: RenderInput): void {
    if (!input.debugEnabled || !input.mapgenDebugEnabled) {
      // Очищаем оверлей только если он был нарисован раньше.
      if (this.container.children.length > 0) {
        this.container.removeChildren();
      }
      return;
    }

    this.container.removeChildren();

    const map = input.state.map;
    if (!map.rooms.length && !map.corridors.length) return;

    const roomGraphics = new Graphics();
    for (const room of map.rooms) {
      const color = colorForRoom(room);
      roomGraphics.rect(
        room.x * TILE_SIZE,
        room.y * TILE_SIZE,
        room.width * TILE_SIZE,
        room.height * TILE_SIZE,
      );
      roomGraphics.fill({ color, alpha: ROOM_FILL_ALPHA });
      roomGraphics.stroke({ width: ROOM_STROKE_WIDTH, color, alpha: ROOM_STROKE_ALPHA });
    }
    this.container.addChild(roomGraphics);

    if (map.corridors.length) {
      const corridorGraphics = new Graphics();
      for (let i = 0; i < map.corridors.length; i++) {
        const corridor = map.corridors[i]!;
        const color = colorForCorridor(i);
        for (const segment of corridor.segments) {
          const x1 = segment.x1 * TILE_SIZE + TILE_SIZE / 2;
          const y1 = segment.y1 * TILE_SIZE + TILE_SIZE / 2;
          const x2 = segment.x2 * TILE_SIZE + TILE_SIZE / 2;
          const y2 = segment.y2 * TILE_SIZE + TILE_SIZE / 2;

          // Рисуем коридор как тонкий прямоугольник вдоль линии,
          // чтобы он был виден даже при совпадении с тайлами пола.
          if (x1 === x2) {
            const minY = Math.min(y1, y2);
            const maxY = Math.max(y1, y2);
            corridorGraphics.rect(x1 - TILE_SIZE / 4, minY - TILE_SIZE / 4, TILE_SIZE / 2, maxY - minY + TILE_SIZE / 2);
          } else {
            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);
            corridorGraphics.rect(minX - TILE_SIZE / 4, y1 - TILE_SIZE / 4, maxX - minX + TILE_SIZE / 2, TILE_SIZE / 2);
          }
          corridorGraphics.fill({ color, alpha: CORRIDOR_FILL_ALPHA });
        }
        corridorGraphics.stroke({ width: CORRIDOR_STROKE_WIDTH, color, alpha: CORRIDOR_STROKE_ALPHA });
      }
      this.container.addChild(corridorGraphics);
    }
  }
}
