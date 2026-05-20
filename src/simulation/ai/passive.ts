// @ts-nocheck
/**
 * Пассивное поведение ИИ.
 *
 * Логика:
 * 1. Если атакован (hp < maxHp) → бежать от игрока
 * 2. Иначе → бродить по случайной соседней проходимой клетке
 */

import type {EnemyEntity, GameEvent, GameState} from '../types';
import {moveEntity} from '../systems/movement';
import {isBlocked} from '../state';
import {rngPick} from '../../utils/rng';
import {CARDINAL_DELTAS} from '../../utils/math';

export function passiveBehavior(state: GameState, enemy: EnemyEntity): GameEvent[] {
  const wasAttacked = enemy.hp < enemy.maxHp;

  if (wasAttacked) {
    // Бежать: двигаться от игрока
    const dx = Math.sign(enemy.x - state.player.x);
    const dy = Math.sign(enemy.y - state.player.y);

    if (dx !== 0 || dy !== 0) {
      const events = moveEntity(state, enemy.id, dx, dy);
      if (events.length > 0) return events;
    }
  }

  // Бродить: выбрать случайную проходимую соседнюю клетку
  const walkable = CARDINAL_DELTAS
    .map(d => ({ x: enemy.x + d.x, y: enemy.y + d.y }))
    .filter(pos => !isBlocked(state, pos.x, pos.y));

  if (walkable.length === 0) return [];

  const target = rngPick(state.rng, walkable);
  return moveEntity(state, enemy.id, target.x - enemy.x, target.y - enemy.y);
}
