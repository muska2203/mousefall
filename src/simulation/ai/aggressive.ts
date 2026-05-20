// @ts-nocheck
/**
 * Агрессивное поведение ИИ.
 *
 * Логика:
 * 1. Если игрок в пределах дальности зрения → тревога, погоня
 * 2. Если рядом с игроком → атака
 * 3. Если в тревоге, но игрок вне зоны видимости → двигаться к последней известной позиции
 * 4. Если не в тревоге → оставаться на месте (блуждание — TODO)
 */

import type {EnemyEntity, GameEvent, GameState} from '../types';
import {attackEntity} from '../systems/combat';
import {moveEntity} from '../systems/movement';
import {chebyshevDistance, nextStepToward} from '../../utils/math';
import {isBlocked} from '../state';
import {PLAYER_ID} from '../../utils/constants';

export function aggressiveBehavior(state: GameState, enemy: EnemyEntity): GameEvent[] {
  const player = state.player;
  const distToPlayer = chebyshevDistance(
    { x: enemy.x, y: enemy.y },
    { x: player.x, y: player.y },
  );

  const sightRange = enemy.aiState.behavior === 'aggressive' ? 6 : 8; // TODO: читать из шаблона

  // Обновление состояния тревоги
  if (distToPlayer <= sightRange) {
    enemy.aiState.isAlerted = true;
    enemy.aiState.lastKnownPlayerPos = { x: player.x, y: player.y };
  }

  // Рядом с игроком → атака
  if (distToPlayer <= 1) {
    return attackEntity(state, enemy.id, PLAYER_ID);
  }

  // Преследовать игрока, если в тревоге
  if (enemy.aiState.isAlerted) {
    const target = enemy.aiState.lastKnownPlayerPos ?? { x: player.x, y: player.y };

    const nextStep = nextStepToward(
      { x: enemy.x, y: enemy.y },
      target,
      (pos) => !isBlocked(state, pos.x, pos.y),
    );

    if (nextStep) {
      const dx = nextStep.x - enemy.x;
      const dy = nextStep.y - enemy.y;
      return moveEntity(state, enemy.id, dx, dy);
    }
  }

  return [];
}
