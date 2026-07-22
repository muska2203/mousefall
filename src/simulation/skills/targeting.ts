import {Entity, EntityId, GameState, Position} from '@simulation/types';
import {computeFOV} from '@simulation/systems/fov';

/**
 * Возвращает все сущности в заданном радиусе от центра (включая центр).
 */
export function getEntitiesInRadius(state: GameState, center: Position, radius: number): Entity[] {
  const result: Entity[] = [];
  for (const entity of state.entities.values()) {
    const dx = entity.x - center.x;
    const dy = entity.y - center.y;
    if (Math.abs(dx) <= radius && Math.abs(dy) <= radius) {
      result.push(entity);
    }
  }
  return result;
}

/**
 * Возвращает позиции клеток в радиусе `radius` от центра (включая центр),
 * ограниченные границами карты. Радиус измеряется по Чебышёву.
 */
export function getPositionsInRadius(state: GameState, center: Position, radius: number): Position[] {
  const positions: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = center.x + dx;
      const y = center.y + dy;
      if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) {
        continue;
      }
      positions.push({ x, y });
    }
  }
  return positions;
}

/**
 * Возвращает позиции клеток, видимых кастеру в заданном радиусе с учётом LOS.
 * Использует тот же алгоритм FOV, что и основная игра, поэтому двери и стены
 * блокируют выбор целей за ними.
 */
export function getVisiblePositionsWithinRange(state: GameState, caster: Entity, range: number): Position[] {
  const visible = computeFOV(state, caster.x, caster.y, range);
  return visible.filter(pos => Math.abs(pos.x - caster.x) + Math.abs(pos.y - caster.y) <= range);
}

/**
 * Возвращает позиции всех сущностей, которые могут получать урон,
 * в заданном радиусе от кастера и в прямой видимости.
 * Кастер исключается из списка целей.
 */
export function getDamageablePositionsWithinRange(state: GameState, caster: Entity, range: number): Position[] {
  const losSet = new Set(getVisiblePositionsWithinRange(state, caster, range).map(p => `${p.x},${p.y}`));
  const positions: Position[] = [];
  for (const entity of state.entities.values()) {
    if (entity.id === caster.id) continue;
    if (!('hp' in entity) || !entity.isAlive) continue;
    const dx = Math.abs(entity.x - caster.x);
    const dy = Math.abs(entity.y - caster.y);
    if (dx + dy <= range && losSet.has(`${entity.x},${entity.y}`)) {
      positions.push({ x: entity.x, y: entity.y });
    }
  }
  return positions;
}

/**
 * Возвращает позиции живых врагов в заданном радиусе от кастера.
 */
export function getEnemyPositionsWithinRange(state: GameState, caster: Entity, range: number): Position[] {
  const positions: Position[] = [];
  for (const entity of state.entities.values()) {
    if (entity.type !== 'enemy') continue;
    if (!('isAlive' in entity) || !entity.isAlive) continue;
    const dx = Math.abs(entity.x - caster.x);
    const dy = Math.abs(entity.y - caster.y);
    if (dx + dy <= range) {
      positions.push({ x: entity.x, y: entity.y });
    }
  }
  return positions;
}

/**
 * Проверяет, видима ли позиция игроку.
 */
export function isPositionVisible(state: GameState, pos: Position): boolean {
  return state.visible[pos.y]?.[pos.x] ?? false;
}

/**
 * Возвращает сущность на заданной позиции или undefined.
 */
export function getEntityAt(state: GameState, pos: Position): Entity | undefined {
  for (const entity of state.entities.values()) {
    if (entity.x === pos.x && entity.y === pos.y) {
      return entity;
    }
  }
  return undefined;
}

/**
 * Возвращает ID сущности на заданной позиции или undefined.
 */
export function getEntityIdAt(state: GameState, pos: Position): EntityId | undefined {
  const entity = getEntityAt(state, pos);
  return entity?.id;
}
