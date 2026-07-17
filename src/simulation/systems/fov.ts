/**
 * Система поля зрения (FOV).
 *
 * Алгоритм: рекурсивное кастование теней (стандартный FOV для рогаликов).
 * Ссылка: http://www.roguebasin.com/index.php/FOV_using_recursive_shadowcasting
 *
 * Контракт:
 * - computeFOV(state, x, y, radius) → Position[]  (чистая функция, без мутаций state)
 * - updateFOV(state) → GameEvent[]               (мутирует visible/explored, возвращает события)
 */

import type { GameState, GameEvent, Position } from '../types';
import { blocksLOS } from '../state';
import { PLAYER_SIGHT_RANGE } from '../../utils/constants';
import { inBounds } from '../../utils/math';

/**
 * Вычисляет набор видимых клеток из точки (originX, originY) с заданным радиусом.
 * Не мутирует состояние — пригодна для использования AI и других систем.
 */
export function computeFOV(
  state: GameState,
  originX: number,
  originY: number,
  radius: number,
): Position[] {
  const visible = new Set<string>();
  visible.add(`${originX},${originY}`);

  for (let octant = 0; octant < 8; octant++) {
    castOctant(state, originX, originY, radius, octant, visible);
  }

  return Array.from(visible).map((key) => {
    const [sx, sy] = key.split(',');
    return { x: Number(sx), y: Number(sy) };
  });
}

/**
 * Пересчитывает FOV из текущей позиции игрока.
 * Обновляет state.visible и state.explored.
 * Вызывается централизованно после успешного хода игрока.
 */
export function updateFOV(state: GameState): GameEvent[] {
  const { width, height } = state.map;
  const { x: px, y: py } = state.player;
  const radius = PLAYER_SIGHT_RANGE;

  // Сброс сетки видимости
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      state.visible[y]![x] = false;
    }
  }

  const newlyVisible: Position[] = [];
  const visiblePositions = computeFOV(state, px, py, radius);

  for (const pos of visiblePositions) {
    const { x, y } = pos;
    state.visible[y]![x] = true;
    if (!state.explored[y]![x]) {
      state.explored[y]![x] = true;
      newlyVisible.push(pos);
    }
  }

  return [{ type: 'FOG_UPDATED', newlyVisible }];
}

// ─────────────────────────────────────────────
// Реализация кастования теней
// ─────────────────────────────────────────────

function castOctant(
  state: GameState,
  originX: number,
  originY: number,
  radius: number,
  octant: number,
  visible: Set<string>,
): void {
  castRow(state, originX, originY, radius, octant, 1, 1.0, 0.0, visible);
}

function castRow(
  state: GameState,
  originX: number,
  originY: number,
  radius: number,
  octant: number,
  row: number,
  startSlope: number,
  endSlope: number,
  visible: Set<string>,
): void {
  if (row > radius) return;
  if (startSlope < endSlope) return;

  let newStartSlope = startSlope;
  let blocked = false;

  for (let col = row; col >= 0; col--) {
    const [dx, dy] = transformOctant(col, row, octant);
    const x = originX + dx;
    const y = originY + dy;

    if (!inBounds({ x, y }, state.map.width, state.map.height)) continue;

    const leftSlope = (col + 0.5) / (row - 0.5);
    const rightSlope = (col - 0.5) / (row + 0.5);

    if (startSlope < rightSlope) continue;
    if (endSlope > leftSlope) break;

    // Клетка в поле зрения
    if (col * col + row * row <= radius * radius) {
      visible.add(`${x},${y}`);
    }

    const isWall = blocksLOS(state, x, y);

    if (blocked) {
      if (isWall) {
        newStartSlope = rightSlope;
      } else {
        blocked = false;
        startSlope = newStartSlope;
      }
    } else if (isWall) {
      blocked = true;
      castRow(state, originX, originY, radius, octant, row + 1, startSlope, leftSlope, visible);
      newStartSlope = rightSlope;
    }
  }

  if (!blocked) {
    castRow(state, originX, originY, radius, octant, row + 1, startSlope, endSlope, visible);
  }
}

/**
 * Преобразует координаты (col, row) в мировые (dx, dy) для заданного октанта.
 * Октанты 0–7 покрывают все 8 направлений.
 */
function transformOctant(col: number, row: number, octant: number): [number, number] {
  switch (octant) {
    case 0: return [ col,  row];
    case 1: return [ row,  col];
    case 2: return [ row, -col];
    case 3: return [ col, -row];
    case 4: return [-col, -row];
    case 5: return [-row, -col];
    case 6: return [-row,  col];
    case 7: return [-col,  row];
    default: return [0, 0];
  }
}
