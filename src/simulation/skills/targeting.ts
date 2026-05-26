import { GameState, Position, Entity, EntityId } from '@simulation/types';

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
 * Возвращает позиции видимых клеток в заданном радиусе от кастера.
 */
export function getVisiblePositionsWithinRange(state: GameState, caster: Entity, range: number): Position[] {
  const positions: Position[] = [];
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const x = caster.x + dx;
      const y = caster.y + dy;
      if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) continue;
      if (Math.abs(dx) + Math.abs(dy) > range) continue; // Манхэттенское расстояние
      if (state.visible[y]?.[x]) {
        positions.push({ x, y });
      }
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
