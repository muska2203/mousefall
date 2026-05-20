// @ts-nocheck
/**
 * Точка входа хода ИИ.
 *
 * Обрабатывает всех врагов в детерминированном порядке (по ID).
 * Направляет к соответствующей функции поведения на основе enemy.aiState.behavior.
 *
 * Вызывается из turn.ts после действия игрока.
 */

import type { GameState, GameEvent, EnemyEntity } from '../types';
import { aggressiveBehavior } from './aggressive';
import { passiveBehavior } from './passive';

/**
 * Обрабатывает всех врагов за ход ИИ.
 * Враги сортируются по ID для детерминированного порядка обработки.
 * Возвращает все события от всех действий врагов.
 */
export function processAllEnemies(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];

  // Сортировка по ID для детерминизма — один и тот же seed всегда даёт одинаковый порядок
  const sortedEnemies = [...state.enemies].sort((a, b) => a.id.localeCompare(b.id));

  for (const enemy of sortedEnemies) {
    // Пропускать мёртвых врагов (могли быть убиты действием другого врага в этот ход)
    if (enemy.hp <= 0) continue;

    const enemyEvents = processEnemy(state, enemy);
    events.push(...enemyEvents);
  }

  return events;
}

/**
 * Обрабатывает ход одного врага.
 * Направляет к соответствующему поведению на основе типа ИИ.
 */
function processEnemy(state: GameState, enemy: EnemyEntity): GameEvent[] {
  // switch (enemy.aiState.behavior) {
  //   case 'aggressive':
  //     return aggressiveBehavior(state, enemy);
  //   case 'passive':
  //     return passiveBehavior(state, enemy);
  //   case 'patrol':
  //     // TODO: реализовать поведение патруля
  //     return aggressiveBehavior(state, enemy); // Пока что fallback на агрессивное
  //   case 'boss':
  //     // TODO: реализовать поведение босса
  //     return aggressiveBehavior(state, enemy); // Пока что fallback на агрессивное
  //   default:
  //     return [];
  // }
}
